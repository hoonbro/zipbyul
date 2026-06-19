package com.jipbyul.api.notification;

import com.jipbyul.api.common.Times;
import com.jipbyul.api.notification.push.PushResult;
import com.jipbyul.api.notification.push.PushSender;
import com.jipbyul.api.user.InterestMatching;
import java.sql.Array;
import java.time.LocalDate;
import java.util.Arrays;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Service;

/** outbox 소비 + fan-out + 사용자별 점수/판정 + dedup + 발송(기획안 6장·7장). */
@Service
public class NotificationDispatcher {

    private static final Logger log = LoggerFactory.getLogger(NotificationDispatcher.class);

    private enum Outcome { IMMEDIATE, DIGEST, IGNORE }

    private final JdbcClient jdbcClient;
    private final OutboxClaimer claimer;
    private final PushSender pushSender;
    private final int maxRetry;

    public NotificationDispatcher(
            JdbcClient jdbcClient,
            OutboxClaimer claimer,
            PushSender pushSender,
            @Value("${notification.consumer.max-retry:5}") int maxRetry) {
        this.jdbcClient = jdbcClient;
        this.claimer = claimer;
        this.pushSender = pushSender;
        this.maxRetry = maxRetry;
    }

    /** 한 사이클: 미처리 이벤트 클레임 후 각각 fan-out. 반환 = 처리한 이벤트 수. */
    public int runOnce() {
        List<OutboxEvent> events = claimer.claim();
        for (OutboxEvent event : events) {
            try {
                fanOut(event);
                markDone(event.id());
            } catch (RuntimeException e) {
                log.error("이벤트 처리 실패 id={}", event.id(), e);
                markRetry(event.id());
            }
        }
        return events.size();
    }

    private void fanOut(OutboxEvent event) {
        EventContext ctx = enrich(event);
        LocalDate today = Times.today();

        for (Candidate user : candidates()) {
            boolean regionMatch = event.guName() != null && user.watchGus().contains(event.guName());
            boolean typeMatch = typeMatch(event, ctx, user);
            if (!regionMatch && !typeMatch) {
                continue;
            }
            int delta = (regionMatch ? 2 : 0) + (typeMatch ? 2 : 0);
            int finalScore = clamp(event.baseScore() + delta, 0, 10);
            Outcome outcome = decide(event, user, regionMatch, finalScore);
            if (outcome == Outcome.IMMEDIATE) {
                deliver(event, ctx, user, today, finalScore);
            }
            // DIGEST/IGNORE: 하루 요약 전달은 다음 슬라이스 (여기선 즉시 발송만)
        }
    }

    private Outcome decide(OutboxEvent event, Candidate user, boolean regionMatch, int finalScore) {
        if ("TRANSACTION_NEW".equals(event.eventType())) {
            return (user.txAlertOptin() && finalScore >= 4) ? Outcome.IMMEDIATE : Outcome.DIGEST;
        }
        return switch (user.alertLevel()) {
            case "ALL" -> Outcome.IMMEDIATE;
            case "IMPORTANT_ONLY" -> finalScore >= 4 ? Outcome.IMMEDIATE : Outcome.DIGEST;
            case "DEADLINE_ONLY" ->
                    "APPLICATION_DEADLINE".equals(event.eventType()) ? Outcome.IMMEDIATE : Outcome.DIGEST;
            case "REGION_ONLY" -> !regionMatch ? Outcome.IGNORE
                    : (finalScore >= 4 ? Outcome.IMMEDIATE : Outcome.DIGEST);
            case "DAILY_DIGEST_ONLY" -> Outcome.DIGEST;
            default -> Outcome.DIGEST;
        };
    }

    private void deliver(OutboxEvent event, EventContext ctx, Candidate user, LocalDate today, int finalScore) {
        String dedupKey = user.anonymousId() + "|" + event.eventType() + "|" + event.refType()
                + "|" + event.refId() + "|" + today;
        List<Token> tokens = devices(user.anonymousId());
        String channel = tokens.isEmpty() ? "IN_APP" : "PUSH";

        Long logId = jdbcClient.sql("""
                INSERT INTO notification_logs
                    (anonymous_id, domain_event_id, channel, status, dedup_key, final_score)
                VALUES (:uid, :eid, :channel, 'SENT', :dedup, :score)
                ON CONFLICT (anonymous_id, dedup_key) DO NOTHING
                RETURNING id
                """)
                .param("uid", user.anonymousId())
                .param("eid", event.id())
                .param("channel", channel)
                .param("dedup", dedupKey)
                .param("score", finalScore)
                .query(Long.class)
                .optional()
                .orElse(null);

        if (logId == null) {
            return; // 이미 발송(DEDUPED)
        }
        if (tokens.isEmpty()) {
            return; // IN_APP 알림함 기록만 (status SENT)
        }

        boolean anySuccess = false;
        String lastReason = null;
        for (Token token : tokens) {
            PushResult r = pushSender.send(token.token(), ctx.title(), ctx.body());
            if (r.success()) {
                anySuccess = true;
                jdbcClient.sql("UPDATE user_devices SET last_success_at=now(), failure_count=0 WHERE id=:id")
                        .param("id", token.id()).update();
            } else {
                lastReason = r.failureReason();
                jdbcClient.sql("""
                        UPDATE user_devices
                        SET last_failure_at=now(), failure_count=failure_count+1,
                            push_enabled = CASE WHEN failure_count+1 >= 3 THEN false ELSE push_enabled END
                        WHERE id=:id
                        """).param("id", token.id()).update();
            }
        }
        if (!anySuccess) {
            jdbcClient.sql("UPDATE notification_logs SET status='FAILED' WHERE id=:id")
                    .param("id", logId).update();
            log.warn("푸시 실패 user={} event={} reason={}", user.anonymousId(), event.id(), lastReason);
        }
    }

    private boolean typeMatch(OutboxEvent event, EventContext ctx, Candidate user) {
        Set<String> interests = user.interestTypes();
        return switch (event.eventType()) {
            case "TRANSACTION_NEW" -> interests.contains("TRANSACTION");
            case "RATE_DECISION" -> interests.contains("POLICY_RATE");
            case "MARKET_INDEX_UPDATED" -> interests.contains("HOUSE_PRICE_OUTLOOK");
            default -> InterestMatching.matches(interests, ctx.supplyType());
        };
    }

    private List<Candidate> candidates() {
        return jdbcClient.sql("""
                SELECT up.anonymous_id, up.alert_level, up.interest_types, up.tx_alert_optin
                FROM user_preferences up
                JOIN anonymous_users au ON au.anonymous_id = up.anonymous_id AND au.status = 'ACTIVE'
                """)
                .query((rs, n) -> {
                    UUID id = rs.getObject("anonymous_id", UUID.class);
                    Array arr = rs.getArray("interest_types");
                    Set<String> interests = arr == null ? Set.of()
                            : Arrays.stream((String[]) arr.getArray()).collect(Collectors.toSet());
                    return new Candidate(id, rs.getString("alert_level"), interests,
                            rs.getBoolean("tx_alert_optin"), watchGus(id));
                })
                .list();
    }

    private Set<String> watchGus(UUID anonymousId) {
        return jdbcClient.sql("SELECT DISTINCT gu_name FROM user_watch_regions WHERE anonymous_id=:id")
                .param("id", anonymousId).query(String.class).set();
    }

    private List<Token> devices(UUID anonymousId) {
        return jdbcClient.sql(
                "SELECT id, device_token FROM user_devices WHERE anonymous_id=:id AND push_enabled=true")
                .param("id", anonymousId)
                .query((rs, n) -> new Token(rs.getLong("id"), rs.getString("device_token")))
                .list();
    }

    private EventContext enrich(OutboxEvent event) {
        if ("ANNOUNCEMENT".equals(event.refType())) {
            Ann ann = jdbcClient.sql("SELECT title, supply_type FROM housing_announcements WHERE id=:id")
                    .param("id", event.refId())
                    .query((rs, n) -> new Ann(rs.getString("title"), rs.getString("supply_type")))
                    .optional().orElse(new Ann("공고", null));
            String title = switch (event.eventType()) {
                case "ANNOUNCEMENT_NEW" -> "새 청약·공공임대 공고";
                case "APPLICATION_START" -> "접수 시작";
                case "APPLICATION_DEADLINE" -> "접수 마감 임박";
                case "WINNER_ANNOUNCEMENT" -> "당첨자 발표";
                case "CONTRACT" -> "계약";
                default -> "공고 소식";
            };
            return new EventContext(title, ann.title(), ann.supplyType());
        }
        if ("TRANSACTION_NEW".equals(event.eventType())) {
            String body = jdbcClient.sql("""
                    SELECT coalesce(gu_name,'') || ' ' || coalesce(dong_name,'') || ' '
                           || coalesce(complex_name,'') FROM real_estate_transactions WHERE id=:id
                    """)
                    .param("id", event.refId()).query(String.class).optional().orElse("실거래 신규 등록");
            return new EventContext("실거래 신규 등록", body.trim(), null);
        }
        return switch (event.eventType()) {
            case "RATE_DECISION" -> new EventContext("기준금리 결정", "기준금리 변경 소식이 있습니다.", null);
            case "MARKET_INDEX_UPDATED" -> new EventContext("집값 전망 심리 갱신", "이번 달 전망 심리가 갱신됐습니다.", null);
            default -> new EventContext(event.eventType(), "", null);
        };
    }

    private void markDone(long id) {
        jdbcClient.sql("UPDATE domain_event SET status='DONE', processed_at=now() WHERE id=:id")
                .param("id", id).update();
    }

    private void markRetry(long id) {
        jdbcClient.sql("""
                UPDATE domain_event
                SET retry_count = retry_count + 1,
                    status = CASE WHEN retry_count + 1 >= :max THEN 'FAILED' ELSE 'NEW' END,
                    claimed_at = NULL
                WHERE id = :id
                """).param("id", id).param("max", maxRetry).update();
    }

    private int clamp(int v, int min, int max) {
        return Math.max(min, Math.min(max, v));
    }

    private record Candidate(UUID anonymousId, String alertLevel, Set<String> interestTypes,
                             boolean txAlertOptin, Set<String> watchGus) {}

    private record Token(long id, String token) {}

    private record EventContext(String title, String body, String supplyType) {}

    private record Ann(String title, String supplyType) {}
}

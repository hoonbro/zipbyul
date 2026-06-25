package com.jipbyul.api.notification;

import com.jipbyul.api.common.Times;
import com.jipbyul.api.notification.push.PushResult;
import com.jipbyul.api.notification.push.PushSender;
import com.jipbyul.api.user.InterestMatching;
import com.jipbyul.api.user.InterestType;
import java.sql.Array;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.OffsetDateTime;
import java.util.Arrays;
import java.util.List;
import java.util.Map;
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
        OffsetDateTime now = OffsetDateTime.now(Times.KST);

        for (Candidate user : candidates(event.guName(), eventInterestCode(event, ctx))) {
            boolean regionMatch = event.guName() != null && user.watchGus().contains(event.guName());
            boolean typeMatch = typeMatch(event, ctx, user);
            if (!regionMatch && !typeMatch) {
                continue;
            }
            int delta = (regionMatch ? 2 : 0) + (typeMatch ? 2 : 0);
            int finalScore = clamp(event.baseScore() + delta, 0, 10);
            Outcome outcome = decide(event, user, regionMatch, finalScore);
            if (outcome == Outcome.IMMEDIATE) {
                if (inDnd(now.toLocalTime(), user.dndStart(), user.dndEnd())) {
                    enqueue(event, ctx, user, today, finalScore, "PUSH",
                            nextAllowedAt(now, user.dndStart(), user.dndEnd()));
                } else {
                    deliver(event, ctx, user, today, finalScore);
                }
            } else if (outcome == Outcome.DIGEST && user.dailyDigestEnabled()) {
                enqueue(event, ctx, user, today, finalScore, "DIGEST",
                        nextDigestAt(now, user.dailyDigestTime(), user.dndStart(), user.dndEnd()));
            }
        }
    }

    /** DND 종료/하루요약 시각이 지난 예약 알림을 전달한다. 반환 = 클레임한 로그 수. */
    public int dispatchDue() {
        jdbcClient.sql("""
                UPDATE notification_logs
                SET status='PENDING', claimed_at=NULL
                WHERE status='CLAIMED' AND claimed_at < now() - interval '5 minutes'
                """).update();

        List<PendingDelivery> due = jdbcClient.sql("""
                SELECT nl.id, nl.anonymous_id, nl.domain_event_id, nl.channel, nl.final_score,
                       de.event_type, de.ref_type, de.ref_id, de.gu_name, de.base_score
                FROM notification_logs nl
                JOIN domain_event de ON de.id = nl.domain_event_id
                JOIN anonymous_users au ON au.anonymous_id = nl.anonymous_id AND au.status = 'ACTIVE'
                WHERE nl.status = 'PENDING' AND nl.available_at <= now()
                ORDER BY nl.available_at, nl.id
                LIMIT 100
                """)
                .query((rs, n) -> new PendingDelivery(
                        rs.getLong("id"),
                        rs.getObject("anonymous_id", UUID.class),
                        new OutboxEvent(
                                rs.getLong("domain_event_id"), rs.getString("event_type"),
                                rs.getString("ref_type"), rs.getLong("ref_id"),
                                rs.getString("gu_name"), rs.getInt("base_score")),
                        rs.getString("channel"), rs.getInt("final_score")))
                .list();

        List<PendingDelivery> claimed = due.stream().filter(this::claim).toList();
        claimed.stream()
                .filter(d -> !"DIGEST".equals(d.channel()))
                .forEach(d -> deliverClaimed(List.of(d), false));

        Map<UUID, List<PendingDelivery>> digestGroups = claimed.stream()
                .filter(d -> "DIGEST".equals(d.channel()))
                .collect(Collectors.groupingBy(PendingDelivery::anonymousId));
        digestGroups.values().forEach(group -> deliverClaimed(group, true));
        return claimed.size();
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
        String dedupKey = dedupKey(user.anonymousId(), event, today);
        List<Token> tokens = devices(user.anonymousId());
        String channel = tokens.isEmpty() ? "IN_APP" : "PUSH";

        Long logId = jdbcClient.sql("""
                INSERT INTO notification_logs
                    (anonymous_id, domain_event_id, channel, status, dedup_key, final_score, sent_at, title, body)
                VALUES (:uid, :eid, :channel, 'SENT', :dedup, :score, now(), :title, :body)
                ON CONFLICT (anonymous_id, dedup_key) DO NOTHING
                RETURNING id
                """)
                .param("uid", user.anonymousId())
                .param("eid", event.id())
                .param("channel", channel)
                .param("dedup", dedupKey)
                .param("score", finalScore)
                .param("title", ctx.title())
                .param("body", ctx.body())
                .query(Long.class)
                .optional()
                .orElse(null);

        if (logId == null) {
            return; // 이미 발송(DEDUPED)
        }
        if (tokens.isEmpty()) {
            return; // IN_APP 알림함 기록만 (status SENT)
        }

        PushAttempt attempt = send(tokens, ctx.title(), ctx.body());
        if (!attempt.anySuccess()) {
            jdbcClient.sql("UPDATE notification_logs SET status='FAILED' WHERE id=:id")
                    .param("id", logId).update();
            log.warn("푸시 실패 user={} event={} reason={}",
                    user.anonymousId(), event.id(), attempt.lastReason());
        }
    }

    private void enqueue(OutboxEvent event, EventContext ctx, Candidate user, LocalDate today,
                         int finalScore, String channel, OffsetDateTime availableAt) {
        jdbcClient.sql("""
                INSERT INTO notification_logs
                    (anonymous_id, domain_event_id, channel, status, dedup_key, final_score, available_at, title, body)
                VALUES (:uid, :eid, :channel, 'PENDING', :dedup, :score, :availableAt, :title, :body)
                ON CONFLICT (anonymous_id, dedup_key) DO NOTHING
                """)
                .param("uid", user.anonymousId())
                .param("eid", event.id())
                .param("channel", channel)
                .param("dedup", dedupKey(user.anonymousId(), event, today))
                .param("score", finalScore)
                .param("availableAt", availableAt)
                .param("title", ctx.title())
                .param("body", ctx.body())
                .update();
    }

    private boolean claim(PendingDelivery delivery) {
        return jdbcClient.sql("""
                UPDATE notification_logs SET status='CLAIMED', claimed_at=now()
                WHERE id=:id AND status='PENDING'
                """)
                .param("id", delivery.logId())
                .update() == 1;
    }

    private void deliverClaimed(List<PendingDelivery> deliveries, boolean digest) {
        if (deliveries.isEmpty()) {
            return;
        }
        PendingDelivery first = deliveries.get(0);
        try {
            List<Token> tokens = devices(first.anonymousId());
            if (tokens.isEmpty()) {
                markDelivery(deliveries, "SENT", true);
                return;
            }

            EventContext firstContext = enrich(first.event());
            String title = digest ? "집별 하루 요약" : firstContext.title();
            String body = digest
                    ? deliveries.size() + "개의 새 소식이 있습니다. " + firstContext.body()
                    : firstContext.body();
            PushAttempt attempt = send(tokens, title, body);
            markDelivery(deliveries, attempt.anySuccess() ? "SENT" : "FAILED", false);
            if (!attempt.anySuccess()) {
                log.warn("예약 푸시 실패 user={} count={} reason={}",
                        first.anonymousId(), deliveries.size(), attempt.lastReason());
            }
        } catch (RuntimeException e) {
            markDelivery(deliveries, "FAILED", false);
            log.error("예약 알림 처리 실패 user={} count={}", first.anonymousId(), deliveries.size(), e);
        }
    }

    private PushAttempt send(List<Token> tokens, String title, String body) {
        boolean anySuccess = false;
        String lastReason = null;
        for (Token token : tokens) {
            PushResult result = pushSender.send(token.token(), title, body);
            if (result.success()) {
                anySuccess = true;
                jdbcClient.sql("UPDATE user_devices SET last_success_at=now(), failure_count=0 WHERE id=:id")
                        .param("id", token.id()).update();
            } else {
                lastReason = result.failureReason();
                jdbcClient.sql("""
                        UPDATE user_devices
                        SET last_failure_at=now(), failure_count=failure_count+1,
                            push_enabled = CASE WHEN failure_count+1 >= 3 THEN false ELSE push_enabled END
                        WHERE id=:id
                        """).param("id", token.id()).update();
            }
        }
        return new PushAttempt(anySuccess, lastReason);
    }

    private void markDelivery(List<PendingDelivery> deliveries, String status, boolean inApp) {
        for (PendingDelivery delivery : deliveries) {
            jdbcClient.sql("""
                    UPDATE notification_logs
                    SET status=:status, channel=CASE WHEN :inApp THEN 'IN_APP' ELSE channel END,
                        sent_at=now(), available_at=NULL, claimed_at=NULL
                    WHERE id=:id AND status='CLAIMED'
                    """)
                    .param("status", status)
                    .param("inApp", inApp)
                    .param("id", delivery.logId())
                    .update();
        }
    }

    private String dedupKey(UUID anonymousId, OutboxEvent event, LocalDate date) {
        return anonymousId + "|" + event.eventType() + "|" + event.refType()
                + "|" + event.refId() + "|" + date;
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

    /** 이벤트가 매칭되는 관심유형 코드(SQL 선필터용). 매핑 없으면 null. */
    private String eventInterestCode(OutboxEvent event, EventContext ctx) {
        return switch (event.eventType()) {
            case "TRANSACTION_NEW" -> "TRANSACTION";
            case "RATE_DECISION" -> "POLICY_RATE";
            case "MARKET_INDEX_UPDATED" -> "HOUSE_PRICE_OUTLOOK";
            default -> {
                InterestType mapped = InterestMatching.forSupplyType(ctx.supplyType());
                yield mapped == null ? null : mapped.name();
            }
        };
    }

    private List<Candidate> candidates(String guName, String interestCode) {
        return jdbcClient.sql("""
                SELECT up.anonymous_id, up.alert_level, up.interest_types, up.tx_alert_optin,
                       up.daily_digest_enabled, up.daily_digest_time, up.dnd_start, up.dnd_end
                FROM user_preferences up
                JOIN anonymous_users au ON au.anonymous_id = up.anonymous_id AND au.status = 'ACTIVE'
                WHERE (:gu::varchar IS NOT NULL
                       AND EXISTS (SELECT 1 FROM user_watch_regions w
                                   WHERE w.anonymous_id = up.anonymous_id AND w.gu_name = :gu::varchar))
                   OR (:interest::varchar IS NOT NULL
                       AND :interest::varchar = ANY(up.interest_types))
                """)
                .param("gu", guName)
                .param("interest", interestCode)
                .query((rs, n) -> {
                    UUID id = rs.getObject("anonymous_id", UUID.class);
                    Array arr = rs.getArray("interest_types");
                    Set<String> interests = arr == null ? Set.of()
                            : Arrays.stream((String[]) arr.getArray()).collect(Collectors.toSet());
                    return new Candidate(id, rs.getString("alert_level"), interests,
                            rs.getBoolean("tx_alert_optin"), watchGus(id),
                            rs.getBoolean("daily_digest_enabled"),
                            rs.getObject("daily_digest_time", LocalTime.class),
                            rs.getObject("dnd_start", LocalTime.class),
                            rs.getObject("dnd_end", LocalTime.class));
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

    static boolean inDnd(LocalTime time, LocalTime start, LocalTime end) {
        if (start == null || end == null || start.equals(end)) {
            return false;
        }
        if (start.isBefore(end)) {
            return !time.isBefore(start) && time.isBefore(end);
        }
        return !time.isBefore(start) || time.isBefore(end);
    }

    static OffsetDateTime nextAllowedAt(OffsetDateTime now, LocalTime start, LocalTime end) {
        if (!inDnd(now.toLocalTime(), start, end)) {
            return now;
        }
        LocalDate endDate = now.toLocalDate();
        if (start.isAfter(end) && !now.toLocalTime().isBefore(start)) {
            endDate = endDate.plusDays(1);
        }
        return endDate.atTime(end).atZone(Times.KST).toOffsetDateTime();
    }

    static OffsetDateTime nextDigestAt(OffsetDateTime now, LocalTime digestTime,
                                       LocalTime dndStart, LocalTime dndEnd) {
        LocalTime effectiveTime = digestTime == null ? LocalTime.of(8, 0) : digestTime;
        OffsetDateTime scheduled = now.toLocalDate().atTime(effectiveTime)
                .atZone(Times.KST).toOffsetDateTime();
        if (!scheduled.isAfter(now)) {
            scheduled = scheduled.plusDays(1);
        }
        return nextAllowedAt(scheduled, dndStart, dndEnd);
    }

    private record Candidate(UUID anonymousId, String alertLevel, Set<String> interestTypes,
                             boolean txAlertOptin, Set<String> watchGus,
                             boolean dailyDigestEnabled, LocalTime dailyDigestTime,
                             LocalTime dndStart, LocalTime dndEnd) {}

    private record Token(long id, String token) {}

    private record PendingDelivery(long logId, UUID anonymousId, OutboxEvent event,
                                   String channel, int finalScore) {}

    private record PushAttempt(boolean anySuccess, String lastReason) {}

    private record EventContext(String title, String body, String supplyType) {}

    private record Ann(String title, String supplyType) {}
}

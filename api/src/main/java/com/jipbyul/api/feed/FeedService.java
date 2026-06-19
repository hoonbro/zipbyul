package com.jipbyul.api.feed;

import com.jipbyul.api.common.Times;
import com.jipbyul.api.feed.dto.FeedHomeResponse;
import com.jipbyul.api.feed.dto.FeedHomeResponse.DataFreshness;
import com.jipbyul.api.feed.dto.FeedHomeResponse.UrgentEvent;
import com.jipbyul.api.feed.dto.FeedHomeResponse.UserCard;
import com.jipbyul.api.marketindex.MarketIndexService;
import com.jipbyul.api.marketindex.dto.MarketOutlookCard;
import com.jipbyul.api.transaction.TransactionService;
import com.jipbyul.api.user.AnonymousUserService;
import com.jipbyul.api.user.InterestMatching;
import com.jipbyul.api.watch.WatchService;
import java.sql.Array;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Comparator;
import java.util.List;
import java.util.UUID;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Service;

@Service
public class FeedService {

    private static final int URGENT_WINDOW_DAYS = 7;
    private static final int URGENT_LIMIT = 5;
    private static final int RECENT_TX_LIMIT = 5;

    private final JdbcClient jdbcClient;
    private final AnonymousUserService anonymousUserService;
    private final WatchService watchService;
    private final MarketIndexService marketIndexService;
    private final TransactionService transactionService;

    public FeedService(JdbcClient jdbcClient, AnonymousUserService anonymousUserService,
                       WatchService watchService, MarketIndexService marketIndexService,
                       TransactionService transactionService) {
        this.jdbcClient = jdbcClient;
        this.anonymousUserService = anonymousUserService;
        this.watchService = watchService;
        this.marketIndexService = marketIndexService;
        this.transactionService = transactionService;
    }

    public FeedHomeResponse home(UUID anonymousId) {
        anonymousUserService.requireActive(anonymousId);

        List<String> watchRegions = watchService.watchRegions(anonymousId);
        List<String> interestTypes = interestTypes(anonymousId);
        LocalDate today = Times.today();

        return new FeedHomeResponse(
                today,
                new UserCard(anonymousId, watchRegions, interestTypes),
                marketOutlook(),
                urgentEvents(today, watchRegions, interestTypes),
                watchService.summary(watchRegions),
                transactionService.recentByRegions(watchRegions, RECENT_TX_LIMIT),
                dataFreshness());
    }

    private MarketOutlookCard marketOutlook() {
        try {
            return marketIndexService.housePriceOutlookCard();
        } catch (RuntimeException e) {
            return null;
        }
    }

    private List<String> interestTypes(UUID anonymousId) {
        return jdbcClient.sql("SELECT interest_types FROM user_preferences WHERE anonymous_id = :id")
                .param("id", anonymousId)
                .query((rs, n) -> {
                    Array arr = rs.getArray("interest_types");
                    return arr == null ? List.<String>of() : Arrays.asList((String[]) arr.getArray());
                })
                .optional()
                .orElse(List.of());
    }

    private List<UrgentEvent> urgentEvents(LocalDate today, List<String> watchRegions, List<String> interestTypes) {
        List<Candidate> candidates = jdbcClient.sql("""
                SELECT ci.id, ci.gu_name, ci.event_date, ha.title, ha.supply_type, sr.name AS source_name
                FROM calendar_items ci
                JOIN housing_announcements ha ON ci.ref_type = 'ANNOUNCEMENT' AND ha.id = ci.ref_id
                JOIN source_registry sr ON sr.source_code = ha.source_code
                WHERE ci.event_type = 'APPLICATION_DEADLINE'
                  AND ci.event_date BETWEEN :today AND :until
                """)
                .param("today", today)
                .param("until", today.plusDays(URGENT_WINDOW_DAYS))
                .query((rs, n) -> new Candidate(
                        rs.getLong("id"),
                        rs.getString("gu_name"),
                        rs.getObject("event_date", LocalDate.class),
                        rs.getString("title"),
                        rs.getString("supply_type"),
                        rs.getString("source_name")))
                .list();

        boolean hasPrefs = !watchRegions.isEmpty() || !interestTypes.isEmpty();
        List<UrgentEvent> scored = new ArrayList<>();
        for (Candidate c : candidates) {
            long dDay = ChronoUnit.DAYS.between(today, c.eventDate());
            boolean regionMatch = c.guName() != null && watchRegions.contains(c.guName());
            boolean typeMatch = InterestMatching.matches(interestTypes, c.supplyType());
            if (hasPrefs && !regionMatch && !typeMatch) {
                continue; // 관심 없는 이벤트는 홈 피드에서 제외
            }
            int base = deadlineBaseScore(dDay);
            int delta = (regionMatch ? 2 : 0) + (typeMatch ? 2 : 0);
            int finalScore = clamp(base + delta, 0, 10);
            scored.add(new UrgentEvent(c.id(), "APPLICATION_DEADLINE", c.title(), c.guName(),
                    c.eventDate(), dDay, base, stars(finalScore), c.sourceName()));
        }
        scored.sort(Comparator
                .comparingInt(UrgentEvent::stars).reversed()
                .thenComparingLong(UrgentEvent::dDay));
        return scored.size() > URGENT_LIMIT ? scored.subList(0, URGENT_LIMIT) : scored;
    }

    private DataFreshness dataFreshness() {
        Freshness f = jdbcClient.sql("""
                SELECT max(last_success_at) AS last_success,
                       bool_or(NOT COALESCE(display_available, true)) AS any_unavailable
                FROM source_health_status
                """)
                .query((rs, n) -> new Freshness(
                        rs.getObject("last_success", OffsetDateTime.class),
                        rs.getBoolean("any_unavailable")))
                .single();

        List<String> notices = new ArrayList<>();
        notices.add("실거래가는 신고 지연으로 최근 데이터가 일부 누락될 수 있습니다.");
        if (f.anyUnavailable()) {
            notices.add("일부 데이터는 마지막 갱신 기준입니다.");
        }
        return new DataFreshness(f.lastSuccess(), f.anyUnavailable(), notices);
    }

    private int deadlineBaseScore(long dDay) {
        if (dDay <= 1) {
            return 3;
        }
        if (dDay <= 3) {
            return 2;
        }
        return 1;
    }

    private int stars(int finalScore) {
        if (finalScore <= 1) {
            return 1;
        }
        if (finalScore <= 3) {
            return 2;
        }
        if (finalScore <= 5) {
            return 3;
        }
        if (finalScore <= 7) {
            return 4;
        }
        return 5;
    }

    private int clamp(int v, int min, int max) {
        return Math.max(min, Math.min(max, v));
    }

    private record Candidate(long id, String guName, LocalDate eventDate, String title,
                             String supplyType, String sourceName) {}

    private record Freshness(OffsetDateTime lastSuccess, boolean anyUnavailable) {}
}

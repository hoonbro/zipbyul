package com.jipbyul.api.watch;

import com.jipbyul.api.common.Times;
import com.jipbyul.api.watch.dto.RegionSummaryItem;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Service;

@Service
public class WatchService {

    private static final int DEADLINE_WINDOW_DAYS = 7;
    private static final int RECENT_TX_DAYS = 7;

    private final JdbcClient jdbcClient;

    public WatchService(JdbcClient jdbcClient) {
        this.jdbcClient = jdbcClient;
    }

    public List<String> watchRegions(UUID anonymousId) {
        return jdbcClient.sql(
                "SELECT DISTINCT gu_name FROM user_watch_regions WHERE anonymous_id = :id ORDER BY gu_name")
                .param("id", anonymousId)
                .query(String.class)
                .list();
    }

    public List<RegionSummaryItem> summary(List<String> guNames) {
        LocalDate today = Times.today();
        return guNames.stream().map(gu -> regionSummary(gu, today)).toList();
    }

    private RegionSummaryItem regionSummary(String guName, LocalDate today) {
        long announcementCount = jdbcClient.sql(
                "SELECT count(*) FROM housing_announcements WHERE gu_name = :gu AND apply_end >= :today")
                .param("gu", guName).param("today", today)
                .query(Long.class).single();

        long deadlineCount = jdbcClient.sql("""
                SELECT count(*) FROM housing_announcements
                WHERE gu_name = :gu AND apply_end BETWEEN :today AND :until
                """)
                .param("gu", guName).param("today", today)
                .param("until", today.plusDays(DEADLINE_WINDOW_DAYS))
                .query(Long.class).single();

        long recentTxCount = jdbcClient.sql("""
                SELECT count(*) FROM real_estate_transactions
                WHERE gu_name = :gu AND first_seen_at >= :since
                """)
                .param("gu", guName)
                .param("since", today.minusDays(RECENT_TX_DAYS).atStartOfDay(Times.KST).toOffsetDateTime())
                .query(Long.class).single();

        return new RegionSummaryItem(guName, announcementCount, deadlineCount, recentTxCount);
    }
}

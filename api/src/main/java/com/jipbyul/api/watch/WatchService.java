package com.jipbyul.api.watch;

import com.jipbyul.api.common.Times;
import com.jipbyul.api.watch.dto.ComplexSummaryItem;
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
    private static final int COMPLEX_RECENT_TX_DAYS = 90; // 단지 1곳은 거래가 드물어 창을 넓게 잡는다
    // complex_norm 정규화는 V10 함수형 인덱스/안전마진 매칭과 동일 규칙(공백·괄호·숫자·'차' 제거).
    private static final String NORM = "regexp_replace(complex_name, '[[:space:]()0-9차]', '', 'g')";

    private final JdbcClient jdbcClient;

    public WatchService(JdbcClient jdbcClient) {
        this.jdbcClient = jdbcClient;
    }

    public List<String> watchRegions(UUID anonymousId) {
        return jdbcClient.sql(
                "SELECT gu_name FROM user_watch_regions WHERE anonymous_id = :id"
                        + " GROUP BY gu_name ORDER BY min(sort_order), gu_name")
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

    public List<ComplexSummaryItem> complexSummary(UUID anonymousId) {
        LocalDate today = Times.today();
        var since = today.minusDays(COMPLEX_RECENT_TX_DAYS)
                .atStartOfDay(Times.KST).toOffsetDateTime();
        return jdbcClient.sql(
                "SELECT gu_name, complex_norm, display_name FROM user_watch_complexes "
                        + "WHERE anonymous_id = :id ORDER BY created_at")
                .param("id", anonymousId)
                .query((rs, n) -> new Watched(
                        rs.getString("gu_name"), rs.getString("complex_norm"), rs.getString("display_name")))
                .list()
                .stream()
                .map(w -> complexSummaryOf(w, today, since))
                .toList();
    }

    private ComplexSummaryItem complexSummaryOf(Watched w, LocalDate today, java.time.OffsetDateTime since) {
        long recentTxCount = jdbcClient.sql(("""
                SELECT count(*) FROM real_estate_transactions
                WHERE gu_name = :gu AND %s = :norm AND first_seen_at >= :since
                """).formatted(NORM))
                .param("gu", w.guName()).param("norm", w.complexNorm()).param("since", since)
                .query(Long.class).single();

        var latest = jdbcClient.sql(("""
                SELECT price_manwon, contract_date FROM real_estate_transactions
                WHERE gu_name = :gu AND %s = :norm AND trade_type = 'SALE' AND price_manwon IS NOT NULL
                ORDER BY contract_date DESC LIMIT 1
                """).formatted(NORM))
                .param("gu", w.guName()).param("norm", w.complexNorm())
                .query((rs, n) -> new LatestSale(
                        rs.getObject("price_manwon", Long.class),
                        rs.getObject("contract_date", LocalDate.class)))
                .optional().orElse(new LatestSale(null, null));

        long openAnnouncementCount = jdbcClient.sql("""
                SELECT count(*) FROM housing_announcements
                WHERE complex_norm = :norm AND apply_end >= :today
                """)
                .param("norm", w.complexNorm()).param("today", today)
                .query(Long.class).single();

        return new ComplexSummaryItem(
                w.complexNorm(), w.displayName(), w.guName(),
                recentTxCount, latest.priceManwon(), latest.contractDate(), openAnnouncementCount);
    }

    public void addComplex(UUID anonymousId, String guName, String complexNorm, String displayName) {
        jdbcClient.sql("""
                INSERT INTO user_watch_complexes (anonymous_id, gu_name, complex_norm, display_name)
                VALUES (:id, :gu, :norm, :name)
                ON CONFLICT (anonymous_id, gu_name, complex_norm) DO NOTHING
                """)
                .param("id", anonymousId).param("gu", guName)
                .param("norm", complexNorm).param("name", displayName)
                .update();
    }

    public void removeComplex(UUID anonymousId, String guName, String complexNorm) {
        jdbcClient.sql("DELETE FROM user_watch_complexes "
                + "WHERE anonymous_id = :id AND gu_name = :gu AND complex_norm = :norm")
                .param("id", anonymousId).param("gu", guName).param("norm", complexNorm)
                .update();
    }

    private record Watched(String guName, String complexNorm, String displayName) {}

    private record LatestSale(Long priceManwon, LocalDate contractDate) {}
}

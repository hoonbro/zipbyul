package com.jipbyul.api.marketindex;

import com.jipbyul.api.common.ApiException;
import com.jipbyul.api.common.ErrorCode;
import com.jipbyul.api.marketindex.dto.HousePriceOutlookResponse;
import com.jipbyul.api.marketindex.dto.HousePriceOutlookResponse.Current;
import com.jipbyul.api.marketindex.dto.HousePriceOutlookResponse.Point;
import com.jipbyul.api.marketindex.dto.HousePriceOutlookResponse.Source;
import com.jipbyul.api.marketindex.dto.MarketOutlookCard;
import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.List;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Service;

@Service
public class MarketIndexService {

    private static final String INDEX_CODE = "HOUSE_PRICE_OUTLOOK_SEOUL_CSI";
    private static final String DISCLAIMER =
            "전망 심리는 실제 가격 변동과 다를 수 있으며 투자 판단의 근거가 아닙니다.";

    private final JdbcClient jdbcClient;

    public MarketIndexService(JdbcClient jdbcClient) {
        this.jdbcClient = jdbcClient;
    }

    public HousePriceOutlookResponse housePriceOutlook() {
        IndexMeta meta = jdbcClient.sql("""
                SELECT mi.name, mi.region, sr.name AS provider
                FROM market_indices mi
                JOIN source_registry sr ON sr.source_code = mi.source_code
                WHERE mi.index_code = :code
                """)
                .param("code", INDEX_CODE)
                .query((rs, n) -> new IndexMeta(rs.getString("name"), rs.getString("region"), rs.getString("provider")))
                .optional()
                .orElseThrow(() -> new ApiException(ErrorCode.INTERNAL_ERROR, "지표 메타가 없습니다: " + INDEX_CODE));

        List<Snapshot> snapshots = jdbcClient.sql("""
                SELECT base_month, value, band, collected_at
                FROM market_index_snapshots
                WHERE index_code = :code
                ORDER BY base_month
                """)
                .param("code", INDEX_CODE)
                .query((rs, n) -> new Snapshot(
                        rs.getString("base_month"),
                        rs.getBigDecimal("value"),
                        rs.getString("band"),
                        rs.getObject("collected_at", OffsetDateTime.class)))
                .list();

        if (snapshots.isEmpty()) {
            throw new ApiException(ErrorCode.UPSTREAM_UNAVAILABLE, "집값전망 데이터가 아직 없습니다.");
        }

        Snapshot latest = snapshots.get(snapshots.size() - 1);
        BigDecimal change = snapshots.size() >= 2
                ? latest.value().subtract(snapshots.get(snapshots.size() - 2).value())
                : null;

        List<Point> history = snapshots.stream()
                .map(s -> new Point(s.baseMonth(), s.value()))
                .toList();

        OffsetDateTime lastCollectedAt = snapshots.stream()
                .map(Snapshot::collectedAt)
                .max(OffsetDateTime::compareTo)
                .orElse(latest.collectedAt());

        return new HousePriceOutlookResponse(
                INDEX_CODE,
                meta.name(),
                meta.region(),
                new Current(latest.baseMonth(), latest.value(), latest.band(), change),
                history,
                new Source(meta.name(), meta.provider(), lastCollectedAt),
                DISCLAIMER);
    }

    /** 홈 피드용 요약 카드 (출처 URL 포함). */
    public MarketOutlookCard housePriceOutlookCard() {
        HousePriceOutlookResponse r = housePriceOutlook();
        String sourceUrl = jdbcClient.sql("""
                SELECT sr.base_url
                FROM market_indices mi
                JOIN source_registry sr ON sr.source_code = mi.source_code
                WHERE mi.index_code = :code
                """)
                .param("code", INDEX_CODE)
                .query(String.class)
                .optional()
                .orElse(null);
        return new MarketOutlookCard(
                r.indexCode(), r.name(), r.region(),
                r.current().value(), r.current().band(), r.current().baseMonth(),
                r.source().name(), sourceUrl, r.source().lastCollectedAt(), r.disclaimer());
    }

    private record IndexMeta(String name, String region, String provider) {}

    private record Snapshot(String baseMonth, BigDecimal value, String band, OffsetDateTime collectedAt) {}
}

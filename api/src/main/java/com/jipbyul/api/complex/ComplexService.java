package com.jipbyul.api.complex;

import com.jipbyul.api.common.ApiException;
import com.jipbyul.api.common.ErrorCode;
import com.jipbyul.api.complex.dto.ComplexDetail;
import com.jipbyul.api.complex.dto.ComplexDetail.BandSummary;
import com.jipbyul.api.complex.dto.ComplexDetail.TrendPoint;
import com.jipbyul.api.complex.dto.ComplexSearchItem;
import com.jipbyul.api.common.Times;
import com.jipbyul.api.transaction.TransactionService;
import java.time.LocalDate;
import java.util.List;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Service;

/**
 * 단지 검색 — 단지 레지스트리가 없어 실거래(real_estate_transactions)에서 DISTINCT 단지를 도출한다.
 * complex_norm 정규화는 V10 함수형 인덱스/안전마진 매칭과 동일 규칙(공백·괄호·숫자·'차' 제거).
 */
@Service
public class ComplexService {

    private static final int LIMIT = 30;
    private static final int TREND_MONTHS = 12;   // 매매 추이 창
    private static final int SUMMARY_MONTHS = 6;  // 평형대 요약(전세가율·갭) 창
    private static final int RECENT_TX_LIMIT = 20;
    private static final String NORM = "regexp_replace(complex_name, '[[:space:]()0-9차]', '', 'g')";
    // 전용면적(㎡) → 평형대. 프론트 필터와 동일 경계(66·99·132).
    private static final String BAND = """
            CASE WHEN area_m2 < 66 THEN '~20평'
                 WHEN area_m2 < 99 THEN '20평대'
                 WHEN area_m2 < 132 THEN '30평대'
                 ELSE '40평대+' END""";

    private final JdbcClient jdbcClient;
    private final TransactionService transactionService;

    public ComplexService(JdbcClient jdbcClient, TransactionService transactionService) {
        this.jdbcClient = jdbcClient;
        this.transactionService = transactionService;
    }

    public List<ComplexSearchItem> search(String guName, String query) {
        String like = "%" + (query == null ? "" : query.trim()) + "%";
        return jdbcClient.sql("""
                SELECT %s AS complex_norm,
                       max(complex_name) AS display_name,
                       gu_name,
                       count(*) AS tx_count,
                       max(contract_date) AS last_contract_date
                FROM real_estate_transactions
                WHERE gu_name = :gu
                  AND complex_name IS NOT NULL
                  AND %s <> ''
                  AND complex_name ILIKE :like
                GROUP BY 1, gu_name
                ORDER BY tx_count DESC
                LIMIT %d
                """.formatted(NORM, NORM, LIMIT))
                .param("gu", guName)
                .param("like", like)
                .query((rs, n) -> new ComplexSearchItem(
                        rs.getString("complex_norm"),
                        rs.getString("display_name"),
                        rs.getString("gu_name"),
                        rs.getLong("tx_count"),
                        rs.getObject("last_contract_date", LocalDate.class)))
                .list();
    }

    public ComplexDetail detail(String guName, String complexNorm) {
        Header header = jdbcClient.sql(("""
                SELECT max(complex_name) AS display_name, max(build_year) AS build_year, count(*) AS n
                FROM real_estate_transactions
                WHERE gu_name = :gu AND %s = :norm
                """).formatted(NORM))
                .param("gu", guName).param("norm", complexNorm)
                .query((rs, n) -> new Header(
                        rs.getString("display_name"),
                        (Integer) rs.getObject("build_year"),
                        rs.getLong("n")))
                .single();
        if (header.count() == 0 || header.displayName() == null) {
            throw new ApiException(ErrorCode.INVALID_REGION, "해당 단지를 찾을 수 없습니다.");
        }

        LocalDate today = Times.today();

        List<TrendPoint> saleTrend = jdbcClient.sql(("""
                SELECT %s AS band, contract_month AS month,
                       percentile_cont(0.5) WITHIN GROUP (ORDER BY price_manwon)::bigint AS median,
                       count(*) AS cnt
                FROM real_estate_transactions
                WHERE gu_name = :gu AND %s = :norm
                  AND trade_type = 'SALE' AND price_manwon IS NOT NULL AND area_m2 IS NOT NULL
                  AND contract_date >= :since
                GROUP BY band, contract_month
                ORDER BY contract_month, band
                """).formatted(BAND, NORM))
                .param("gu", guName).param("norm", complexNorm)
                .param("since", today.minusMonths(TREND_MONTHS).withDayOfMonth(1))
                .query((rs, n) -> new TrendPoint(
                        rs.getString("band"), rs.getString("month"),
                        rs.getLong("median"), rs.getLong("cnt")))
                .list();

        List<BandSummary> bandSummary = jdbcClient.sql(("""
                SELECT band,
                       max(CASE WHEN trade_type = 'SALE'   THEN med END) AS sale_med,
                       max(CASE WHEN trade_type = 'JEONSE' THEN med END) AS jeonse_med,
                       sum(CASE WHEN trade_type = 'SALE'   THEN cnt ELSE 0 END) AS sale_cnt,
                       sum(CASE WHEN trade_type = 'JEONSE' THEN cnt ELSE 0 END) AS jeonse_cnt
                FROM (
                    SELECT %s AS band, trade_type,
                           percentile_cont(0.5) WITHIN GROUP (ORDER BY price_manwon)::bigint AS med,
                           count(*) AS cnt
                    FROM real_estate_transactions
                    WHERE gu_name = :gu AND %s = :norm
                      AND trade_type IN ('SALE','JEONSE')
                      AND price_manwon IS NOT NULL AND area_m2 IS NOT NULL
                      AND contract_date >= :since
                    GROUP BY band, trade_type
                ) g
                GROUP BY band
                ORDER BY min(CASE band WHEN '~20평' THEN 1 WHEN '20평대' THEN 2 WHEN '30평대' THEN 3 ELSE 4 END)
                """).formatted(BAND, NORM))
                .param("gu", guName).param("norm", complexNorm)
                .param("since", today.minusMonths(SUMMARY_MONTHS).withDayOfMonth(1))
                .query((rs, n) -> {
                    Long sale = (Long) rs.getObject("sale_med");
                    Long jeonse = (Long) rs.getObject("jeonse_med");
                    Double ratio = (sale != null && jeonse != null && sale > 0)
                            ? Math.round((double) jeonse / sale * 1000) / 1000.0 : null;
                    Long gap = (sale != null && jeonse != null) ? sale - jeonse : null;
                    return new BandSummary(rs.getString("band"), sale, jeonse, ratio, gap,
                            rs.getLong("sale_cnt"), rs.getLong("jeonse_cnt"));
                })
                .list();

        List<com.jipbyul.api.transaction.dto.RecentTransactionsResponse.Item> recent =
                transactionService.recentByComplex(guName, complexNorm, RECENT_TX_LIMIT);

        return new ComplexDetail(complexNorm, header.displayName(), guName, header.buildYear(),
                saleTrend, bandSummary, recent);
    }

    private record Header(String displayName, Integer buildYear, long count) {}
}

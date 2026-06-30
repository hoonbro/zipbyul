package com.jipbyul.api.transaction;

import com.jipbyul.api.common.ApiException;
import com.jipbyul.api.common.ErrorCode;
import com.jipbyul.api.transaction.dto.RecentTransactionsResponse;
import com.jipbyul.api.transaction.dto.RecentTransactionsResponse.Item;
import java.math.BigDecimal;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.Collection;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Service;

@Service
public class TransactionService {

    public static final String NOTICE =
            "실거래가는 신고 후 등록되므로 최근 1~2주 데이터는 불완전할 수 있습니다.";

    private static final String SELECT_PREFIX = """
            SELECT t.id, t.gu_name, t.dong_name, t.complex_name, t.trade_type,
                   t.area_m2, t.floor, t.price_manwon, t.contract_date, t.contract_month,
                   t.first_seen_at, sr.name AS source_name,
                   t.build_year, t.registered_at, t.building_dong, t.dealing_type,
                   t.jibun, t.land_area_m2, t.monthly_rent_manwon
            FROM real_estate_transactions t
            JOIN source_registry sr ON sr.source_code = t.source_code
            """;

    private final JdbcClient jdbcClient;

    public TransactionService(JdbcClient jdbcClient) {
        this.jdbcClient = jdbcClient;
    }

    private static final java.util.Set<String> TRADE_TYPES =
            java.util.Set.of("SALE", "JEONSE", "MONTHLY", "PRESALE");

    public RecentTransactionsResponse recent(TransactionFilter f, int limit) {
        String region = f.region();
        String dong = f.dong();
        if (f.bjdCode() != null && !f.bjdCode().isBlank()) {
            Region resolved = resolveBjd(f.bjdCode());
            region = resolved.guName();
            if (resolved.dongName() != null) {
                dong = resolved.dongName();   // 동 레벨 코드면 동까지 좁힘
            }
        } else if (region != null && !region.isBlank()) {
            requireRegion(region);
        }

        StringBuilder sql = new StringBuilder(SELECT_PREFIX).append(" WHERE 1 = 1");
        Map<String, Object> params = new HashMap<>();
        params.put("limit", limit);

        if (region != null && !region.isBlank()) {
            sql.append(" AND t.gu_name = :region");
            params.put("region", region);
        }
        if (dong != null && !dong.isBlank()) {
            sql.append(" AND t.dong_name = :dong");
            params.put("dong", dong);
        }
        if (f.tradeType() != null && !f.tradeType().isBlank()) {
            if (!TRADE_TYPES.contains(f.tradeType())) {
                throw new ApiException(ErrorCode.INVALID_ENUM, "지원하지 않는 거래유형입니다: " + f.tradeType());
            }
            sql.append(" AND t.trade_type = :tradeType");
            params.put("tradeType", f.tradeType());
        }
        if (f.areaMin() != null) {
            sql.append(" AND t.area_m2 >= :areaMin");
            params.put("areaMin", f.areaMin());
        }
        if (f.areaMax() != null) {
            sql.append(" AND t.area_m2 < :areaMax");
            params.put("areaMax", f.areaMax());
        }
        if (f.priceMin() != null) {
            sql.append(" AND t.price_manwon >= :priceMin");
            params.put("priceMin", f.priceMin());
        }
        if (f.priceMax() != null) {
            sql.append(" AND t.price_manwon <= :priceMax");
            params.put("priceMax", f.priceMax());
        }
        if (f.floorMin() != null) {
            sql.append(" AND t.floor >= :floorMin");
            params.put("floorMin", f.floorMin());
        }
        if (f.floorMax() != null) {
            sql.append(" AND t.floor <= :floorMax");
            params.put("floorMax", f.floorMax());
        }
        if (f.buildYearMin() != null) {
            sql.append(" AND t.build_year >= :buildYearMin");
            params.put("buildYearMin", f.buildYearMin());
        }
        if (f.buildYearMax() != null) {
            sql.append(" AND t.build_year <= :buildYearMax");
            params.put("buildYearMax", f.buildYearMax());
        }
        if (f.contractFrom() != null) {
            sql.append(" AND t.contract_date >= :contractFrom");
            params.put("contractFrom", f.contractFrom());
        }
        if (f.contractTo() != null) {
            sql.append(" AND t.contract_date <= :contractTo");
            params.put("contractTo", f.contractTo());
        }
        sql.append(" ORDER BY t.first_seen_at DESC LIMIT :limit");

        List<Item> items = jdbcClient.sql(sql.toString()).params(params).query(this::mapItem).list();
        return new RecentTransactionsResponse(items, NOTICE);
    }

    /** 특정 단지(complex_norm)의 최근 거래. complex_norm 규칙은 V10 인덱스와 동일. */
    public List<Item> recentByComplex(String guName, String complexNorm, int limit) {
        return jdbcClient.sql(SELECT_PREFIX
                + " WHERE t.gu_name = :gu"
                + " AND regexp_replace(t.complex_name, '[[:space:]()0-9차]', '', 'g') = :norm"
                + " ORDER BY t.first_seen_at DESC LIMIT :limit")
                .param("gu", guName)
                .param("norm", complexNorm)
                .param("limit", limit)
                .query(this::mapItem)
                .list();
    }

    /** 여러 자치구의 최근 등록 실거래 (홈 피드용). 빈 목록이면 전체 기준. */
    public List<Item> recentByRegions(Collection<String> guNames, int limit) {
        if (guNames == null || guNames.isEmpty()) {
            return recent(TransactionFilter.empty(), limit).items();
        }
        String literal = "{" + String.join(",", guNames) + "}";
        return jdbcClient.sql(SELECT_PREFIX
                + " WHERE t.gu_name = ANY(:gus::varchar[]) ORDER BY t.first_seen_at DESC LIMIT :limit")
                .param("gus", literal)
                .param("limit", limit)
                .query(this::mapItem)
                .list();
    }

    private Item mapItem(ResultSet rs, int rowNum) throws SQLException {
        long priceManwon = rs.getLong("price_manwon");
        boolean priceNull = rs.wasNull();
        int buildYear = rs.getInt("build_year");
        boolean buildYearNull = rs.wasNull();
        long monthlyRent = rs.getLong("monthly_rent_manwon");
        boolean monthlyRentNull = rs.wasNull();
        return new Item(
                rs.getLong("id"),
                rs.getString("gu_name"),
                rs.getString("dong_name"),
                rs.getString("complex_name"),
                rs.getString("trade_type"),
                rs.getBigDecimal("area_m2"),
                (Integer) rs.getObject("floor"),
                priceNull ? null : priceManwon,
                priceNull ? null : priceText(priceManwon),
                rs.getObject("contract_date", LocalDate.class),
                rs.getString("contract_month"),
                rs.getObject("first_seen_at", OffsetDateTime.class),
                rs.getString("source_name"),
                buildYearNull ? null : buildYear,
                rs.getObject("registered_at", LocalDate.class),
                rs.getString("building_dong"),
                rs.getString("dealing_type"),
                rs.getString("jibun"),
                rs.getBigDecimal("land_area_m2"),
                monthlyRentNull ? null : monthlyRent);
    }

    private Region resolveBjd(String bjdCode) {
        return jdbcClient.sql("SELECT gu_name, dong_name FROM region_code WHERE bjd_code = :bjd")
                .param("bjd", bjdCode)
                .query((rs, n) -> new Region(rs.getString("gu_name"), rs.getString("dong_name")))
                .optional()
                .orElseThrow(() -> new ApiException(ErrorCode.INVALID_REGION,
                        "지원하지 않는 법정동코드입니다: " + bjdCode));
    }

    private record Region(String guName, String dongName) {}

    private void requireRegion(String guName) {
        int found = jdbcClient.sql("SELECT count(*) FROM region_code WHERE gu_name = :gu")
                .param("gu", guName)
                .query(Integer.class)
                .single();
        if (found == 0) {
            throw new ApiException(ErrorCode.INVALID_REGION, "지원하지 않는 자치구입니다: " + guName);
        }
    }

    /** 만원 단위 금액을 사람이 읽는 문자열로. 1억 이상은 억 단위, 그 미만은 만원. */
    private String priceText(long manwon) {
        if (manwon >= 10000) {
            double eok = manwon / 10000.0;
            String value = eok == Math.floor(eok)
                    ? String.valueOf((long) eok)
                    : new BigDecimal(eok).setScale(1, java.math.RoundingMode.HALF_UP).toPlainString();
            return value + "억";
        }
        return String.format("%,d만", manwon);
    }
}

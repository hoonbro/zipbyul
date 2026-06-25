package com.jipbyul.api.margin;

import com.jipbyul.api.margin.dto.AnnouncementMargin;
import com.jipbyul.api.margin.dto.UnitMargin;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Service;

/**
 * 안전마진 산출 (기획안 §4). MVP 매칭 단위 = 같은 자치구(gu_name) + 전용면적 ±5㎡ + 최근 6개월 SALE 중앙값.
 * 상세(주택형 표)와 캘린더 카드(대표 등급)가 한 번의 LATERAL 쿼리를 공유한다.
 */
@Service
public class SafetyMarginService {

    static final int SAMPLE_MIN = 5; // 표본 부족 임계(§4)
    static final BigDecimal AREA_TOL = new BigDecimal("5"); // 전용면적 ±㎡
    static final int MONTHS = 6;
    static final double HIGH_RATIO = 0.15; // 15%↑ 저렴 → 높음
    static final BigDecimal REP_AREA = new BigDecimal("59"); // 대표 주택형 기준(국민평형)

    private final JdbcClient jdbcClient;

    public SafetyMarginService(JdbcClient jdbcClient) {
        this.jdbcClient = jdbcClient;
    }

    public Map<Long, AnnouncementMargin> compute(List<Long> announcementIds) {
        if (announcementIds == null || announcementIds.isEmpty()) {
            return Map.of();
        }
        LocalDate since = LocalDate.now().minusMonths(MONTHS);

        List<Row> rows = jdbcClient.sql("""
                SELECT au.announcement_id AS aid, au.house_type, au.area_m2, au.supply_amount_manwon,
                       ha.gu_name, ha.price_cap_yn, ha.supply_type,
                       m.median_price, m.sample_count
                FROM announcement_unit au
                JOIN housing_announcements ha ON ha.id = au.announcement_id
                LEFT JOIN LATERAL (
                    SELECT percentile_cont(0.5) WITHIN GROUP (ORDER BY t.price_manwon) AS median_price,
                           count(*) AS sample_count
                    FROM real_estate_transactions t
                    WHERE t.gu_name = ha.gu_name
                      AND t.trade_type = 'SALE'
                      AND t.area_m2 BETWEEN au.area_m2 - :tol AND au.area_m2 + :tol
                      AND t.contract_date >= :since
                ) m ON true
                WHERE au.announcement_id IN (:ids)
                ORDER BY au.announcement_id, au.area_m2, au.house_type
                """)
                .param("tol", AREA_TOL)
                .param("since", since)
                .param("ids", announcementIds)
                .query((rs, n) -> new Row(
                        rs.getLong("aid"),
                        rs.getString("house_type"),
                        rs.getObject("area_m2", BigDecimal.class),
                        rs.getObject("supply_amount_manwon", Long.class),
                        rs.getString("gu_name"),
                        rs.getObject("price_cap_yn", Boolean.class),
                        rs.getString("supply_type"),
                        rs.getObject("median_price", Double.class),
                        rs.getLong("sample_count")))
                .list();

        Map<Long, List<Row>> byAnnouncement = new LinkedHashMap<>();
        for (Row r : rows) {
            byAnnouncement.computeIfAbsent(r.aid(), k -> new ArrayList<>()).add(r);
        }

        Map<Long, AnnouncementMargin> result = new LinkedHashMap<>();
        for (var entry : byAnnouncement.entrySet()) {
            List<Row> group = entry.getValue();
            List<UnitMargin> units = group.stream().map(SafetyMarginService::toUnit).toList();

            int repIdx = representativeIndex(group);
            String repGrade = units.get(repIdx).grade();
            Row head = group.get(0);
            boolean priceCap = Boolean.TRUE.equals(head.priceCapYn());
            boolean unranked = "UNRANKED".equals(head.supplyType());

            result.put(entry.getKey(), new AnnouncementMargin(
                    entry.getKey(), priceCap, unranked, repGrade, head.guName(), MONTHS, units));
        }
        return result;
    }

    private static UnitMargin toUnit(Row r) {
        boolean unavailable = r.sampleCount() < SAMPLE_MIN || r.medianPrice() == null
                || r.supplyAmountManwon() == null;
        if (unavailable) {
            return new UnitMargin(r.houseType(), r.areaM2(), r.supplyAmountManwon(),
                    null, null, null, "UNAVAILABLE", r.sampleCount());
        }
        double median = r.medianPrice();
        double margin = median - r.supplyAmountManwon();
        double ratio = margin / median;
        return new UnitMargin(
                r.houseType(), r.areaM2(), r.supplyAmountManwon(),
                Math.round(median), Math.round(margin), ratio, grade(ratio), r.sampleCount());
    }

    private static String grade(double ratio) {
        if (ratio >= HIGH_RATIO) return "HIGH";
        if (ratio <= 0) return "LOW";
        return "MID";
    }

    /**
     * 대표 주택형(§5): 전용 59㎡ 우선 → 없으면 더 큰 면적(59↑ 중 최소, 없으면 최대) → 동일 면적이면 접미사 A.
     * area_m2 null 은 비교에서 맨 뒤로.
     */
    private static int representativeIndex(List<Row> group) {
        List<Integer> idx = new ArrayList<>();
        for (int i = 0; i < group.size(); i++) {
            idx.add(i);
        }
        Comparator<Integer> byHouseType = Comparator.comparing(
                i -> group.get(i).houseType(), Comparator.nullsLast(Comparator.naturalOrder()));

        List<Integer> atLeast59 = idx.stream()
                .filter(i -> group.get(i).areaM2() != null
                        && group.get(i).areaM2().compareTo(REP_AREA) >= 0)
                .toList();

        if (!atLeast59.isEmpty()) {
            // 59↑ 중 가장 작은 면적 → 동일 면적이면 접미사 A (min = 오름차순 최소)
            Comparator<Integer> byAreaAsc = Comparator.comparing(i -> group.get(i).areaM2());
            return atLeast59.stream().min(byAreaAsc.thenComparing(byHouseType)).orElse(0);
        }
        // 59 이상이 없으면 가장 큰 면적 → 동일 면적이면 접미사 A.
        // max 이므로 A 가 '가장 큰' 값이 되도록 houseType 비교를 뒤집는다.
        Comparator<Integer> byAreaNullsFirst = Comparator.comparing(
                i -> group.get(i).areaM2(), Comparator.nullsFirst(Comparator.naturalOrder()));
        return idx.stream()
                .max(byAreaNullsFirst.thenComparing(byHouseType.reversed()))
                .orElse(0);
    }

    private record Row(
            long aid,
            String houseType,
            BigDecimal areaM2,
            Long supplyAmountManwon,
            String guName,
            Boolean priceCapYn,
            String supplyType,
            Double medianPrice,
            long sampleCount) {}
}

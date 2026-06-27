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
 * 안전마진 산출 (기획안 §4 + V10 개선). 전용면적 ±5㎡ · 최근 6개월 SALE 기준에,
 * 매칭 단위를 계층화: 같은 단지(무순위 complex_norm) → 인근 분양권(같은 동 PRESALE)
 * → 자치구 분양권(12개월) → 같은 동 준신축 매매 → 자치구 준신축 매매.
 * 신축 분양가가 구축에 눌려 LOW로 과대판정되지 않도록, 분양권(신축 동급)을 우선 소진한 뒤에야 매매로 떨어진다.
 * 분양권은 시장이 얇아 동·6개월로는 표본이 부족한 경우가 많아, 임계를 따로 낮추고(PRESALE_SAMPLE_MIN)
 * 구·12개월 분양권을 백업 단계로 둔다. 동·구 매매는 준신축(build_year)만 본다.
 * 상세(주택형 표)와 캘린더 카드(대표 등급)가 한 번의 LATERAL 쿼리를 공유한다.
 */
@Service
public class SafetyMarginService {

    static final int SAMPLE_MIN = 5; // 표본 부족 임계(§4)
    static final int PRESALE_SAMPLE_MIN = 3; // 분양권은 시장이 얇아 임계를 낮춤(신축 동급 비교 우선)
    static final BigDecimal AREA_TOL = new BigDecimal("5"); // 전용면적 ±㎡
    static final int MONTHS = 6;
    static final int PRESALE_GU_MONTHS = 12; // 자치구 분양권 백업 단계 기간(얇은 표본 보강)
    static final int NEW_BUILD_MAX_AGE = 15; // 준신축 기준: 입주 N년 이내만 비교군(신축 보정)
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
        LocalDate sincePresaleGu = LocalDate.now().minusMonths(PRESALE_GU_MONTHS);
        int buildYearMin = LocalDate.now().getYear() - NEW_BUILD_MAX_AGE;

        List<Row> rows = jdbcClient.sql("""
                SELECT au.announcement_id AS aid, au.house_type, au.area_m2, au.supply_count,
                       au.supply_amount_manwon,
                       ha.gu_name, ha.price_cap_yn, ha.supply_type,
                       CASE WHEN m_complex.sample_count    >= :min     THEN m_complex.median_price
                            WHEN m_presale.sample_count    >= :presale THEN m_presale.median_price
                            WHEN m_presale_gu.sample_count >= :presale THEN m_presale_gu.median_price
                            WHEN m_dong.sample_count       >= :min     THEN m_dong.median_price
                            WHEN m_gu.sample_count         >= :min     THEN m_gu.median_price END AS median_price,
                       CASE WHEN m_complex.sample_count    >= :min     THEN m_complex.sample_count
                            WHEN m_presale.sample_count    >= :presale THEN m_presale.sample_count
                            WHEN m_presale_gu.sample_count >= :presale THEN m_presale_gu.sample_count
                            WHEN m_dong.sample_count       >= :min     THEN m_dong.sample_count
                            WHEN m_gu.sample_count         >= :min     THEN m_gu.sample_count
                            ELSE 0 END AS sample_count,
                       CASE WHEN m_complex.sample_count    >= :min     THEN 'COMPLEX'
                            WHEN m_presale.sample_count    >= :presale THEN 'PRESALE'
                            WHEN m_presale_gu.sample_count >= :presale THEN 'PRESALE_GU'
                            WHEN m_dong.sample_count       >= :min     THEN 'DONG'
                            WHEN m_gu.sample_count         >= :min     THEN 'GU' END AS basis_level
                FROM announcement_unit au
                JOIN housing_announcements ha ON ha.id = au.announcement_id
                LEFT JOIN LATERAL (
                    SELECT percentile_cont(0.5) WITHIN GROUP (ORDER BY t.price_manwon) AS median_price,
                           count(*) AS sample_count
                    FROM real_estate_transactions t
                    WHERE ha.supply_type = 'UNRANKED' AND ha.complex_norm IS NOT NULL
                      AND regexp_replace(t.complex_name, '[[:space:]()0-9차]', '', 'g') = ha.complex_norm
                      AND t.trade_type = 'SALE'
                      AND t.area_m2 BETWEEN au.area_m2 - :tol AND au.area_m2 + :tol
                      AND t.contract_date >= :since
                ) m_complex ON true
                LEFT JOIN LATERAL (
                    SELECT percentile_cont(0.5) WITHIN GROUP (ORDER BY t.price_manwon) AS median_price,
                           count(*) AS sample_count
                    FROM real_estate_transactions t
                    WHERE ha.dong_name IS NOT NULL AND t.dong_name = ha.dong_name
                      AND t.trade_type = 'PRESALE'
                      AND t.area_m2 BETWEEN au.area_m2 - :tol AND au.area_m2 + :tol
                      AND t.contract_date >= :since
                ) m_presale ON true
                LEFT JOIN LATERAL (
                    SELECT percentile_cont(0.5) WITHIN GROUP (ORDER BY t.price_manwon) AS median_price,
                           count(*) AS sample_count
                    FROM real_estate_transactions t
                    WHERE t.gu_name = ha.gu_name
                      AND t.trade_type = 'PRESALE'
                      AND t.area_m2 BETWEEN au.area_m2 - :tol AND au.area_m2 + :tol
                      AND t.contract_date >= :sincePresaleGu
                ) m_presale_gu ON true
                LEFT JOIN LATERAL (
                    SELECT percentile_cont(0.5) WITHIN GROUP (ORDER BY t.price_manwon) AS median_price,
                           count(*) AS sample_count
                    FROM real_estate_transactions t
                    WHERE ha.dong_name IS NOT NULL AND t.dong_name = ha.dong_name
                      AND t.trade_type = 'SALE'
                      AND t.build_year >= :buildYearMin
                      AND t.area_m2 BETWEEN au.area_m2 - :tol AND au.area_m2 + :tol
                      AND t.contract_date >= :since
                ) m_dong ON true
                LEFT JOIN LATERAL (
                    SELECT percentile_cont(0.5) WITHIN GROUP (ORDER BY t.price_manwon) AS median_price,
                           count(*) AS sample_count
                    FROM real_estate_transactions t
                    WHERE t.gu_name = ha.gu_name
                      AND t.trade_type = 'SALE'
                      AND t.build_year >= :buildYearMin
                      AND t.area_m2 BETWEEN au.area_m2 - :tol AND au.area_m2 + :tol
                      AND t.contract_date >= :since
                ) m_gu ON true
                WHERE au.announcement_id IN (:ids)
                ORDER BY au.announcement_id, au.area_m2, au.house_type
                """)
                .param("tol", AREA_TOL)
                .param("since", since)
                .param("sincePresaleGu", sincePresaleGu)
                .param("buildYearMin", buildYearMin)
                .param("min", SAMPLE_MIN)
                .param("presale", PRESALE_SAMPLE_MIN)
                .param("ids", announcementIds)
                .query((rs, n) -> new Row(
                        rs.getLong("aid"),
                        rs.getString("house_type"),
                        rs.getObject("area_m2", BigDecimal.class),
                        rs.getObject("supply_count", Integer.class),
                        rs.getObject("supply_amount_manwon", Long.class),
                        rs.getString("gu_name"),
                        rs.getObject("price_cap_yn", Boolean.class),
                        rs.getString("supply_type"),
                        rs.getObject("median_price", Double.class),
                        rs.getLong("sample_count"),
                        rs.getString("basis_level")))
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
            String basisLevel = group.get(repIdx).basisLevel();
            Row head = group.get(0);
            boolean priceCap = Boolean.TRUE.equals(head.priceCapYn());
            boolean unranked = "UNRANKED".equals(head.supplyType());

            result.put(entry.getKey(), new AnnouncementMargin(
                    entry.getKey(), priceCap, unranked, repGrade, head.guName(), MONTHS,
                    basisLevel, units));
        }
        return result;
    }

    private static UnitMargin toUnit(Row r) {
        boolean unavailable = r.medianPrice() == null || r.supplyAmountManwon() == null;
        if (unavailable) {
            return new UnitMargin(r.houseType(), r.areaM2(), r.supplyCount(), r.supplyAmountManwon(),
                    null, null, null, "UNAVAILABLE", r.sampleCount());
        }
        double median = r.medianPrice();
        double margin = median - r.supplyAmountManwon();
        double ratio = margin / median;
        return new UnitMargin(
                r.houseType(), r.areaM2(), r.supplyCount(), r.supplyAmountManwon(),
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
            Integer supplyCount,
            Long supplyAmountManwon,
            String guName,
            Boolean priceCapYn,
            String supplyType,
            Double medianPrice,
            long sampleCount,
            String basisLevel) {}
}

package com.jipbyul.api.transaction;

import java.time.LocalDate;

/** 실거래 조회 필터. 모든 항목 nullable이며 null이면 해당 조건을 적용하지 않는다. */
public record TransactionFilter(
        String region,
        String dong,
        String bjdCode,
        String tradeType,
        Double areaMin,
        Double areaMax,
        Long priceMin,
        Long priceMax,
        Integer floorMin,
        Integer floorMax,
        Integer buildYearMin,
        Integer buildYearMax,
        LocalDate contractFrom,
        LocalDate contractTo,
        Integer recentDays) {

    public static TransactionFilter empty() {
        return new TransactionFilter(null, null, null, null, null, null,
                null, null, null, null, null, null, null, null, null);
    }
}

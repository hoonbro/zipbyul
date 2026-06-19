package com.jipbyul.api.marketindex.dto;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.List;

public record HousePriceOutlookResponse(
        String indexCode,
        String name,
        String region,
        Current current,
        List<Point> history,
        Source source,
        String disclaimer) {

    public record Current(String baseMonth, BigDecimal value, String band, BigDecimal changeFromPrevMonth) {}

    public record Point(String baseMonth, BigDecimal value) {}

    public record Source(String name, String provider, OffsetDateTime lastCollectedAt) {}
}

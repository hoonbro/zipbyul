package com.jipbyul.api.transaction.dto;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.List;

public record RecentTransactionsResponse(List<Item> items, String notice) {

    public record Item(
            long transactionId,
            String regionName,
            String dong,
            String complexName,
            String tradeType,
            BigDecimal areaM2,
            Integer floor,
            Long priceManwon,
            String priceText,
            LocalDate contractDate,
            String contractMonth,
            OffsetDateTime firstSeenAt,
            String sourceName) {}
}

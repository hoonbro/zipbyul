package com.jipbyul.api.watch.dto;

import java.time.LocalDate;

public record ComplexSummaryItem(
        String complexNorm,
        String displayName,
        String guName,
        long recentTransactionCount,
        Long latestSalePriceManwon,
        LocalDate latestSaleContractDate,
        long openAnnouncementCount) {}

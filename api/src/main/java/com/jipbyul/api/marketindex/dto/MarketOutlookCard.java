package com.jipbyul.api.marketindex.dto;

import java.math.BigDecimal;
import java.time.OffsetDateTime;

/** 홈 피드용 집값전망 요약 카드 (기획안 4-4 marketOutlook). */
public record MarketOutlookCard(
        String indexCode,
        String name,
        String region,
        BigDecimal value,
        String band,
        String baseMonth,
        String sourceName,
        String sourceUrl,
        OffsetDateTime lastCollectedAt,
        String disclaimer) {}

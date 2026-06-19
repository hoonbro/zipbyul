package com.jipbyul.api.announcement.dto;

import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.Map;

public record AnnouncementDetail(
        long id,
        String pblancNo,
        String title,
        String supplyType,
        String regionName,
        String bjdCode,
        LocalDate applyStart,
        LocalDate applyEnd,
        LocalDate winnerAnnounceDate,
        LocalDate contractDate,
        String sourceName,
        String sourceUrl,
        Map<String, Object> summary,
        OffsetDateTime collectedAt,
        OffsetDateTime updatedAt) {}

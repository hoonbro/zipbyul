package com.jipbyul.api.announcement.dto;

import java.time.LocalDate;

public record AnnouncementSummary(
        long id,
        String pblancNo,
        String title,
        String supplyType,
        String regionName,
        LocalDate applyStart,
        LocalDate applyEnd,
        LocalDate winnerAnnounceDate,
        String sourceName,
        String sourceUrl) {}

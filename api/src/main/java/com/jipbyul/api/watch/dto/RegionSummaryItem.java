package com.jipbyul.api.watch.dto;

public record RegionSummaryItem(
        String regionName,
        long announcementCount,
        long deadlineCount,
        long recentTransactionCount) {}

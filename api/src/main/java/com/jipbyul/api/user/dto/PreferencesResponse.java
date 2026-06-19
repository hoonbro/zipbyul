package com.jipbyul.api.user.dto;

import java.time.LocalTime;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

public record PreferencesResponse(
        UUID anonymousId,
        String alertLevel,
        List<String> interestTypes,
        boolean txAlertOptin,
        boolean dailyDigestEnabled,
        LocalTime dailyDigestTime,
        LocalTime dndStart,
        LocalTime dndEnd,
        List<WatchRegionDto> watchRegions,
        OffsetDateTime updatedAt) {}

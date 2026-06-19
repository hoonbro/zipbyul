package com.jipbyul.api.user.dto;

import com.jipbyul.api.user.AlertLevel;
import com.jipbyul.api.user.InterestType;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import java.time.LocalTime;
import java.util.List;

/** 설정 저장/수정 요청. PUT은 전체 교체(upsert) 시맨틱. */
public record PreferencesRequest(
        @NotNull AlertLevel alertLevel,
        List<InterestType> interestTypes,
        Boolean txAlertOptin,
        Boolean dailyDigestEnabled,
        LocalTime dailyDigestTime,
        LocalTime dndStart,
        LocalTime dndEnd,
        @Valid List<WatchRegionDto> watchRegions) {}

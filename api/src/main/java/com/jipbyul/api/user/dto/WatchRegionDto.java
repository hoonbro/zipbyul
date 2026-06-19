package com.jipbyul.api.user.dto;

import jakarta.validation.constraints.NotBlank;

/** 관심지역: 자치구(gu_name) 필수 + 법정동코드(bjd_code) 선택(실거래 좁힘). */
public record WatchRegionDto(@NotBlank String guName, String bjdCode) {}

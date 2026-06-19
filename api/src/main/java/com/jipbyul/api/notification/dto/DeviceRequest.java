package com.jipbyul.api.notification.dto;

import jakarta.validation.constraints.NotBlank;

public record DeviceRequest(@NotBlank String deviceToken) {}

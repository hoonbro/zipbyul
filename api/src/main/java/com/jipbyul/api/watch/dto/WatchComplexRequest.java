package com.jipbyul.api.watch.dto;

import jakarta.validation.constraints.NotBlank;

public record WatchComplexRequest(
        @NotBlank String guName,
        @NotBlank String complexNorm,
        @NotBlank String displayName) {}

package com.jipbyul.api.source.dto;

import java.time.OffsetDateTime;

public record SourceHealthItem(
        String sourceCode,
        String name,
        String grade,
        OffsetDateTime lastSuccessAt,
        OffsetDateTime lastFailureAt,
        String lastFailureReason,
        int recentCollectCount,
        boolean displayAvailable) {}

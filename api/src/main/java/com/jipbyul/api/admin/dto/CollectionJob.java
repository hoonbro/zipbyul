package com.jipbyul.api.admin.dto;

import java.time.OffsetDateTime;

public record CollectionJob(
        long id,
        String source,
        String status,
        OffsetDateTime requestedAt,
        OffsetDateTime startedAt,
        OffsetDateTime finishedAt,
        String message) {}

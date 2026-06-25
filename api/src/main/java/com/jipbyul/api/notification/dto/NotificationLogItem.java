package com.jipbyul.api.notification.dto;

import java.time.OffsetDateTime;

public record NotificationLogItem(
        long id,
        Long domainEventId,
        String channel,
        String status,
        Integer finalScore,
        OffsetDateTime sentAt,
        String title,
        String body) {}

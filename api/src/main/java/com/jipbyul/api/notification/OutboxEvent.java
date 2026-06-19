package com.jipbyul.api.notification;

public record OutboxEvent(
        long id,
        String eventType,
        String refType,
        long refId,
        String guName,
        int baseScore) {}

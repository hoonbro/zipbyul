package com.jipbyul.api.calendar.dto;

import java.time.LocalDate;

public record CalendarItemDto(
        long eventId,
        String refType,
        long refId,
        String eventType,
        String regionName,
        LocalDate eventDate,
        long dDay,
        String title,
        String supplyType,
        String sourceName,
        String sourceUrl) {}

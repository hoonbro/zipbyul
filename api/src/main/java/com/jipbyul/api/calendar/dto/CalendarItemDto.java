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
        String sourceUrl,
        String marginGrade, // 대표 주택형 등급 (HIGH/MID/LOW/UNAVAILABLE), 비공고/미산출은 null
        Boolean priceCap, // 분양가상한제 = 로또 단서
        Boolean unranked) {

    public CalendarItemDto withMargin(String marginGrade, boolean priceCap, boolean unranked) {
        return new CalendarItemDto(eventId, refType, refId, eventType, regionName, eventDate,
                dDay, title, supplyType, sourceName, sourceUrl, marginGrade, priceCap, unranked);
    }
}

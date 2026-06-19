package com.jipbyul.api.calendar;

import com.jipbyul.api.calendar.dto.CalendarItemDto;
import com.jipbyul.api.common.Times;
import java.time.LocalDate;
import java.util.List;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/v1/calendar")
public class CalendarController {

    private final CalendarService service;

    public CalendarController(CalendarService service) {
        this.service = service;
    }

    @GetMapping
    public List<CalendarItemDto> calendar(
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
            @RequestParam(required = false) String type,
            @RequestParam(required = false) String region) {
        LocalDate effectiveFrom = from != null ? from : Times.today();
        LocalDate effectiveTo = to != null ? to : effectiveFrom.plusDays(30);
        return service.find(effectiveFrom, effectiveTo, type, region);
    }
}

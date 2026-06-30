package com.jipbyul.api.announcement;

import com.jipbyul.api.announcement.dto.AnnouncementDetail;
import com.jipbyul.api.announcement.dto.AnnouncementListResponse;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/v1/announcements")
public class AnnouncementController {

    private final AnnouncementService service;

    public AnnouncementController(AnnouncementService service) {
        this.service = service;
    }

    @GetMapping
    public AnnouncementListResponse list(
            @RequestParam(required = false) String region,
            @RequestParam(required = false) String supplyType,
            @RequestParam(defaultValue = "false") boolean openOnly,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        int boundedPage = Math.max(page, 0);
        int boundedSize = Math.min(Math.max(size, 1), 100);
        return service.list(region, supplyType, openOnly, boundedPage, boundedSize);
    }

    @GetMapping("/{id}")
    public AnnouncementDetail detail(@PathVariable long id) {
        return service.detail(id);
    }
}

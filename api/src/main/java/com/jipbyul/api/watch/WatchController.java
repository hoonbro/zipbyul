package com.jipbyul.api.watch;

import com.jipbyul.api.user.AnonymousUserService;
import com.jipbyul.api.watch.dto.RegionSummaryItem;
import java.util.List;
import java.util.UUID;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/v1/watch/regions")
public class WatchController {

    private final WatchService watchService;
    private final AnonymousUserService anonymousUserService;

    public WatchController(WatchService watchService, AnonymousUserService anonymousUserService) {
        this.watchService = watchService;
        this.anonymousUserService = anonymousUserService;
    }

    @GetMapping("/summary")
    public List<RegionSummaryItem> summary(@RequestHeader("X-Anonymous-Id") UUID anonymousId) {
        anonymousUserService.requireActive(anonymousId);
        return watchService.summary(watchService.watchRegions(anonymousId));
    }
}

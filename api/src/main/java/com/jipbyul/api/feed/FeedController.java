package com.jipbyul.api.feed;

import com.jipbyul.api.feed.dto.FeedHomeResponse;
import java.util.UUID;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/v1/feed")
public class FeedController {

    private final FeedService service;

    public FeedController(FeedService service) {
        this.service = service;
    }

    @GetMapping("/home")
    public FeedHomeResponse home(@RequestHeader("X-Anonymous-Id") UUID anonymousId) {
        return service.home(anonymousId);
    }
}

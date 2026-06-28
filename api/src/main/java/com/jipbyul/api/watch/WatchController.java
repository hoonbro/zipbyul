package com.jipbyul.api.watch;

import com.jipbyul.api.user.AnonymousUserService;
import com.jipbyul.api.watch.dto.ComplexSummaryItem;
import com.jipbyul.api.watch.dto.RegionSummaryItem;
import com.jipbyul.api.watch.dto.WatchComplexRequest;
import jakarta.validation.Valid;
import java.util.List;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/v1/watch")
public class WatchController {

    private final WatchService watchService;
    private final AnonymousUserService anonymousUserService;

    public WatchController(WatchService watchService, AnonymousUserService anonymousUserService) {
        this.watchService = watchService;
        this.anonymousUserService = anonymousUserService;
    }

    @GetMapping("/regions/summary")
    public List<RegionSummaryItem> regionSummary(@RequestHeader("X-Anonymous-Id") UUID anonymousId) {
        anonymousUserService.requireActive(anonymousId);
        return watchService.summary(watchService.watchRegions(anonymousId));
    }

    @GetMapping("/complexes")
    public List<ComplexSummaryItem> complexSummary(@RequestHeader("X-Anonymous-Id") UUID anonymousId) {
        anonymousUserService.requireActive(anonymousId);
        return watchService.complexSummary(anonymousId);
    }

    @PostMapping("/complexes")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void addComplex(
            @RequestHeader("X-Anonymous-Id") UUID anonymousId,
            @Valid @RequestBody WatchComplexRequest request) {
        anonymousUserService.requireActive(anonymousId);
        watchService.addComplex(anonymousId, request.guName(), request.complexNorm(), request.displayName());
    }

    @DeleteMapping("/complexes")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void removeComplex(
            @RequestHeader("X-Anonymous-Id") UUID anonymousId,
            @RequestParam String guName,
            @RequestParam String complexNorm) {
        anonymousUserService.requireActive(anonymousId);
        watchService.removeComplex(anonymousId, guName, complexNorm);
    }
}

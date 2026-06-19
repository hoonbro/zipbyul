package com.jipbyul.api.user;

import com.jipbyul.api.user.dto.PreferencesRequest;
import com.jipbyul.api.user.dto.PreferencesResponse;
import jakarta.validation.Valid;
import java.util.UUID;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/v1/preferences")
public class PreferencesController {

    private final PreferencesService service;

    public PreferencesController(PreferencesService service) {
        this.service = service;
    }

    @GetMapping
    public PreferencesResponse get(@RequestHeader("X-Anonymous-Id") UUID anonymousId) {
        return service.get(anonymousId);
    }

    @PutMapping
    public PreferencesResponse update(
            @RequestHeader("X-Anonymous-Id") UUID anonymousId,
            @Valid @RequestBody PreferencesRequest request) {
        return service.update(anonymousId, request);
    }
}

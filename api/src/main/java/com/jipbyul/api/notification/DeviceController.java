package com.jipbyul.api.notification;

import com.jipbyul.api.notification.dto.DeviceRequest;
import com.jipbyul.api.notification.dto.DeviceResponse;
import jakarta.validation.Valid;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/v1/devices")
public class DeviceController {

    private final DeviceService service;

    public DeviceController(DeviceService service) {
        this.service = service;
    }

    @PostMapping
    public ResponseEntity<DeviceResponse> register(
            @RequestHeader("X-Anonymous-Id") UUID anonymousId,
            @Valid @RequestBody DeviceRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(service.register(anonymousId, request.deviceToken()));
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void unregister(
            @RequestHeader("X-Anonymous-Id") UUID anonymousId,
            @PathVariable long id) {
        service.unregister(anonymousId, id);
    }
}

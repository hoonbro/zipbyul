package com.jipbyul.api.user;

import com.jipbyul.api.user.dto.AnonymousUserResponse;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/v1/anonymous-users")
public class AnonymousUserController {

    private final AnonymousUserService service;

    public AnonymousUserController(AnonymousUserService service) {
        this.service = service;
    }

    @PostMapping
    public ResponseEntity<AnonymousUserResponse> create() {
        return ResponseEntity.status(HttpStatus.CREATED).body(service.create());
    }
}

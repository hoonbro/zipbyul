package com.jipbyul.api.user;

import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/v1/me")
public class AccountController {

    private final AnonymousUserService service;

    public AccountController(AnonymousUserService service) {
        this.service = service;
    }

    @DeleteMapping("/data")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteData(@RequestHeader("X-Anonymous-Id") UUID anonymousId) {
        service.deleteData(anonymousId);
    }
}

package com.jipbyul.api.notification;

import java.util.Map;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** 내부용 — 알림 워커를 1회 수동 실행(테스트/운영 점검). */
@RestController
@RequestMapping("/internal/notifications")
public class NotificationAdminController {

    private final NotificationDispatcher dispatcher;

    public NotificationAdminController(NotificationDispatcher dispatcher) {
        this.dispatcher = dispatcher;
    }

    @PostMapping("/run-once")
    public Map<String, Integer> runOnce() {
        return Map.of("processed", dispatcher.runOnce());
    }
}

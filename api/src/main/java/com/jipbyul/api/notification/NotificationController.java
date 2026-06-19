package com.jipbyul.api.notification;

import com.jipbyul.api.notification.dto.NotificationLogItem;
import com.jipbyul.api.user.AnonymousUserService;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** 앱 내 알림함 — notification_logs 조회. */
@RestController
@RequestMapping("/v1/notifications")
public class NotificationController {

    private final JdbcClient jdbcClient;
    private final AnonymousUserService anonymousUserService;

    public NotificationController(JdbcClient jdbcClient, AnonymousUserService anonymousUserService) {
        this.jdbcClient = jdbcClient;
        this.anonymousUserService = anonymousUserService;
    }

    @GetMapping
    public List<NotificationLogItem> list(
            @RequestHeader("X-Anonymous-Id") UUID anonymousId,
            @RequestParam(defaultValue = "30") int limit) {
        anonymousUserService.requireActive(anonymousId);
        int bounded = Math.min(Math.max(limit, 1), 100);
        return jdbcClient.sql("""
                SELECT id, domain_event_id, channel, status, final_score, sent_at
                FROM notification_logs
                WHERE anonymous_id = :id
                  AND status IN ('SENT', 'FAILED')
                ORDER BY sent_at DESC
                LIMIT :limit
                """)
                .param("id", anonymousId)
                .param("limit", bounded)
                .query((rs, n) -> new NotificationLogItem(
                        rs.getLong("id"),
                        (Long) rs.getObject("domain_event_id"),
                        rs.getString("channel"),
                        rs.getString("status"),
                        (Integer) rs.getObject("final_score"),
                        rs.getObject("sent_at", OffsetDateTime.class)))
                .list();
    }
}

package com.jipbyul.api.notification;

import com.jipbyul.api.common.ApiException;
import com.jipbyul.api.common.ErrorCode;
import com.jipbyul.api.notification.dto.DeviceRequest;
import com.jipbyul.api.notification.dto.DeviceResponse;
import com.jipbyul.api.user.AnonymousUserService;
import java.util.UUID;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class DeviceService {

    private final JdbcClient jdbcClient;
    private final AnonymousUserService anonymousUserService;

    public DeviceService(JdbcClient jdbcClient, AnonymousUserService anonymousUserService) {
        this.jdbcClient = jdbcClient;
        this.anonymousUserService = anonymousUserService;
    }

    /** 기기 등록. 채널(FCM/WEBPUSH)에 따라 dedup 키가 다르며, 재등록 시 현재 사용자로 재할당·활성화한다. */
    @Transactional
    public DeviceResponse register(UUID anonymousId, DeviceRequest request) {
        anonymousUserService.requireActive(anonymousId);
        String kind = (request.kind() == null || request.kind().isBlank())
                ? "FCM" : request.kind().trim().toUpperCase();
        return switch (kind) {
            case "FCM" -> registerFcm(anonymousId, request.deviceToken());
            case "WEBPUSH" -> registerWebPush(anonymousId, request);
            default -> throw new ApiException(ErrorCode.INVALID_ENUM, "지원하지 않는 푸시 채널: " + kind);
        };
    }

    private DeviceResponse registerFcm(UUID anonymousId, String deviceToken) {
        if (deviceToken == null || deviceToken.isBlank()) {
            throw new ApiException(ErrorCode.INVALID_ENUM, "FCM 등록에는 deviceToken이 필요합니다.");
        }
        return jdbcClient.sql("""
                INSERT INTO user_devices (anonymous_id, kind, device_token)
                VALUES (:id, 'FCM', :token)
                ON CONFLICT (device_token) DO UPDATE SET
                    anonymous_id = excluded.anonymous_id,
                    kind = 'FCM',
                    push_enabled = true,
                    failure_count = 0
                RETURNING id, device_token, push_enabled
                """)
                .param("id", anonymousId)
                .param("token", deviceToken)
                .query(DeviceResponse.class)
                .single();
    }

    private DeviceResponse registerWebPush(UUID anonymousId, DeviceRequest request) {
        if (isBlank(request.endpoint()) || isBlank(request.p256dh()) || isBlank(request.auth())) {
            throw new ApiException(ErrorCode.INVALID_ENUM,
                    "WebPush 등록에는 endpoint·p256dh·auth가 필요합니다.");
        }
        return jdbcClient.sql("""
                INSERT INTO user_devices (anonymous_id, kind, endpoint, p256dh, auth)
                VALUES (:id, 'WEBPUSH', :endpoint, :p256dh, :auth)
                ON CONFLICT (endpoint) WHERE endpoint IS NOT NULL DO UPDATE SET
                    anonymous_id = excluded.anonymous_id,
                    kind = 'WEBPUSH',
                    p256dh = excluded.p256dh,
                    auth = excluded.auth,
                    push_enabled = true,
                    failure_count = 0
                RETURNING id, device_token, push_enabled
                """)
                .param("id", anonymousId)
                .param("endpoint", request.endpoint())
                .param("p256dh", request.p256dh())
                .param("auth", request.auth())
                .query(DeviceResponse.class)
                .single();
    }

    private static boolean isBlank(String s) {
        return s == null || s.isBlank();
    }

    /** 기기 해제(삭제). 본인 소유가 아니면 NOT_FOUND. */
    @Transactional
    public void unregister(UUID anonymousId, long deviceId) {
        anonymousUserService.requireActive(anonymousId);
        int deleted = jdbcClient.sql(
                "DELETE FROM user_devices WHERE id = :deviceId AND anonymous_id = :id")
                .param("deviceId", deviceId)
                .param("id", anonymousId)
                .update();
        if (deleted == 0) {
            throw new ApiException(ErrorCode.DEVICE_NOT_FOUND);
        }
    }
}

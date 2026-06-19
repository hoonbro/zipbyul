package com.jipbyul.api.notification;

import com.jipbyul.api.common.ApiException;
import com.jipbyul.api.common.ErrorCode;
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

    /** 푸시 토큰 등록. 이미 있는 토큰이면 현재 사용자로 재할당하고 활성화한다. */
    @Transactional
    public DeviceResponse register(UUID anonymousId, String deviceToken) {
        anonymousUserService.requireActive(anonymousId);
        return jdbcClient.sql("""
                INSERT INTO user_devices (anonymous_id, device_token)
                VALUES (:id, :token)
                ON CONFLICT (device_token) DO UPDATE SET
                    anonymous_id = excluded.anonymous_id,
                    push_enabled = true,
                    failure_count = 0
                RETURNING id, device_token, push_enabled
                """)
                .param("id", anonymousId)
                .param("token", deviceToken)
                .query(DeviceResponse.class)
                .single();
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

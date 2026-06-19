package com.jipbyul.api.user;

import com.jipbyul.api.common.ApiException;
import com.jipbyul.api.common.ErrorCode;
import com.jipbyul.api.user.dto.AnonymousUserResponse;
import java.util.UUID;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AnonymousUserService {

    private final JdbcClient jdbcClient;

    public AnonymousUserService(JdbcClient jdbcClient) {
        this.jdbcClient = jdbcClient;
    }

    /** 최초 접속 시 익명 식별자 발급 + 기본 설정 행 생성. */
    @Transactional
    public AnonymousUserResponse create() {
        UUID id = UUID.randomUUID();
        AnonymousUserResponse user = jdbcClient.sql("""
                INSERT INTO anonymous_users (anonymous_id)
                VALUES (:id)
                RETURNING anonymous_id, status, created_at
                """)
                .param("id", id)
                .query(AnonymousUserResponse.class)
                .single();
        jdbcClient.sql("INSERT INTO user_preferences (anonymous_id) VALUES (:id)")
                .param("id", id)
                .update();
        return user;
    }

    /** 식별자가 존재하고 ACTIVE인지 확인하고 last_seen_at을 갱신한다. 아니면 NOT_FOUND. */
    @Transactional
    public void requireActive(UUID anonymousId) {
        String status = jdbcClient.sql("SELECT status FROM anonymous_users WHERE anonymous_id = :id")
                .param("id", anonymousId)
                .query(String.class)
                .optional()
                .orElseThrow(() -> new ApiException(ErrorCode.ANONYMOUS_USER_NOT_FOUND));
        if (!"ACTIVE".equals(status)) {
            throw new ApiException(ErrorCode.ANONYMOUS_USER_NOT_FOUND);
        }
        jdbcClient.sql("UPDATE anonymous_users SET last_seen_at = now() WHERE anonymous_id = :id")
                .param("id", anonymousId)
                .update();
    }

    /** 익명 사용자 데이터 삭제: 설정·기기·관심지역 제거 후 status=DELETED. */
    @Transactional
    public void deleteData(UUID anonymousId) {
        requireActive(anonymousId);
        jdbcClient.sql("DELETE FROM user_devices WHERE anonymous_id = :id").param("id", anonymousId).update();
        jdbcClient.sql("DELETE FROM user_watch_regions WHERE anonymous_id = :id").param("id", anonymousId).update();
        jdbcClient.sql("DELETE FROM user_preferences WHERE anonymous_id = :id").param("id", anonymousId).update();
        jdbcClient.sql("UPDATE anonymous_users SET status = 'DELETED' WHERE anonymous_id = :id")
                .param("id", anonymousId)
                .update();
    }
}

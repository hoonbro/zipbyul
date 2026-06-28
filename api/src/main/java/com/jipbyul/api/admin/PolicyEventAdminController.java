package com.jipbyul.api.admin;

import com.jipbyul.api.common.ApiException;
import com.jipbyul.api.common.ErrorCode;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.LocalDate;
import java.util.List;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * 내부용 — 운영자가 비기준금리 정책 일정(청약제도 변경 등)을 수동 등록한다.
 * 공식 API가 없는(C등급) 정책 콘텐츠를 콘솔로 입력하는 백오피스 1차 슬라이스.
 * policy_events(SSOT) + calendar_items(통합 캘린더)에 한 트랜잭션으로 함께 기록한다.
 */
@RestController
@RequestMapping("/internal/admin/policy")
public class PolicyEventAdminController {

    private static final String EVENT_TYPE = "POLICY_ANNOUNCEMENT";
    private static final String SOURCE_CODE = "ADMIN_MANUAL";

    private final JdbcClient jdbcClient;

    public PolicyEventAdminController(JdbcClient jdbcClient) {
        this.jdbcClient = jdbcClient;
    }

    @PostMapping
    @Transactional
    public PolicyEventItem create(@RequestBody PolicyCommand command) {
        String title = command.title() == null ? "" : command.title().trim();
        if (title.isBlank()) {
            throw new ApiException(ErrorCode.INVALID_ENUM, "정책 일정 제목이 필요합니다.");
        }
        if (command.eventDate() == null) {
            throw new ApiException(ErrorCode.INVALID_DATE_RANGE, "일정 날짜(eventDate)가 필요합니다.");
        }
        String sourceUrl = command.sourceUrl() == null || command.sourceUrl().isBlank()
                ? null : command.sourceUrl().trim();
        boolean seoulWide = command.isSeoulWide() == null || command.isSeoulWide();

        PolicyEventItem saved = jdbcClient.sql("""
                INSERT INTO policy_events
                    (source_code, event_type, title, event_date, is_seoul_wide, source_url, dedup_hash)
                VALUES
                    (:source, :eventType, :title, :eventDate, :seoulWide, :sourceUrl,
                     md5(:eventType || '_' || :title || '_' || :eventDate)
                       || md5(:eventType || '_' || :title || '_' || :eventDate))
                ON CONFLICT (dedup_hash) DO UPDATE
                    SET title         = EXCLUDED.title,
                        event_date    = EXCLUDED.event_date,
                        is_seoul_wide = EXCLUDED.is_seoul_wide,
                        source_url    = EXCLUDED.source_url
                RETURNING id, event_type, title, event_date, is_seoul_wide, source_url
                """)
                .param("source", SOURCE_CODE)
                .param("eventType", EVENT_TYPE)
                .param("title", title)
                .param("eventDate", command.eventDate())
                .param("seoulWide", seoulWide)
                .param("sourceUrl", sourceUrl)
                .query(PolicyEventAdminController::map)
                .single();

        // 날짜 수정(upsert)으로 과거 캘린더 행이 남지 않도록 교체.
        jdbcClient.sql("DELETE FROM calendar_items WHERE ref_type = 'POLICY' AND ref_id = :pid")
                .param("pid", saved.id())
                .update();
        jdbcClient.sql("""
                INSERT INTO calendar_items (ref_type, ref_id, event_type, gu_name, event_date)
                VALUES ('POLICY', :pid, :eventType, NULL, :eventDate)
                """)
                .param("pid", saved.id())
                .param("eventType", EVENT_TYPE)
                .param("eventDate", saved.eventDate())
                .update();
        return saved;
    }

    @GetMapping
    public List<PolicyEventItem> list(@RequestParam(defaultValue = "20") int limit) {
        return jdbcClient.sql("""
                SELECT id, event_type, title, event_date, is_seoul_wide, source_url
                FROM policy_events
                WHERE source_code = :source
                ORDER BY event_date DESC
                LIMIT :limit
                """)
                .param("source", SOURCE_CODE)
                .param("limit", Math.min(Math.max(limit, 1), 100))
                .query(PolicyEventAdminController::map)
                .list();
    }

    private static PolicyEventItem map(ResultSet rs, int rowNum) throws SQLException {
        return new PolicyEventItem(
                rs.getLong("id"),
                rs.getString("event_type"),
                rs.getString("title"),
                rs.getObject("event_date", LocalDate.class),
                rs.getBoolean("is_seoul_wide"),
                rs.getString("source_url"));
    }

    public record PolicyCommand(String title, LocalDate eventDate, String sourceUrl, Boolean isSeoulWide) {}

    public record PolicyEventItem(
            long id, String eventType, String title, LocalDate eventDate,
            boolean isSeoulWide, String sourceUrl) {}
}

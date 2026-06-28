package com.jipbyul.api.admin;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.jipbyul.api.common.ApiException;
import com.jipbyul.api.common.ErrorCode;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.format.DateTimeParseException;
import java.util.List;
import java.util.Set;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * 내부용 — 운영자가 SH 공공임대(청년안심주택·장기전세) 공고를 수동 등록한다.
 * 공식 API가 없는(C등급) SH 콘텐츠 입력 경로. 쓰기 경계 유지를 위해 Spring은
 * manual_announcement_queue에만 INSERT하고, 공고 본체 적재는 수집기(Python)가
 * 큐를 드레인하며 기존 upsert_announcement 경로로 처리한다.
 */
@RestController
@RequestMapping("/internal/admin/announcement")
public class AnnouncementAdminController {

    private static final Set<String> SH_SUPPLY = Set.of("YOUTH_SAFE_HOUSE", "LONG_TERM_JEONSE");

    private final JdbcClient jdbcClient;
    private final ObjectMapper objectMapper;

    public AnnouncementAdminController(JdbcClient jdbcClient, ObjectMapper objectMapper) {
        this.jdbcClient = jdbcClient;
        this.objectMapper = objectMapper;
    }

    @PostMapping
    public QueueItem enqueue(@RequestBody AnnouncementCommand command) {
        String supplyType = trim(command.supplyType());
        if (!SH_SUPPLY.contains(supplyType)) {
            throw new ApiException(ErrorCode.INVALID_ENUM,
                    "supplyType은 YOUTH_SAFE_HOUSE/LONG_TERM_JEONSE 중 하나여야 합니다.");
        }
        if (trim(command.title()).isBlank()) {
            throw new ApiException(ErrorCode.INVALID_ENUM, "공고 제목이 필요합니다.");
        }
        requireRegion(trim(command.guName()));
        LocalDate start = parseDate(command.applyStart(), "applyStart");
        LocalDate end = parseDate(command.applyEnd(), "applyEnd");
        if (start != null && end != null && end.isBefore(start)) {
            throw new ApiException(ErrorCode.INVALID_DATE_RANGE, "접수 마감이 접수 시작보다 빠릅니다.");
        }

        String payload;
        try {
            payload = objectMapper.writeValueAsString(command);
        } catch (JsonProcessingException e) {
            throw new ApiException(ErrorCode.INTERNAL_ERROR, "입력 직렬화에 실패했습니다.");
        }
        return jdbcClient.sql("""
                INSERT INTO manual_announcement_queue (payload)
                VALUES (:payload::jsonb)
                RETURNING id, status, announcement_id, message, requested_at, processed_at
                """)
                .param("payload", payload)
                .query(AnnouncementAdminController::map)
                .single();
    }

    @GetMapping
    public List<QueueItem> list(@RequestParam(defaultValue = "20") int limit) {
        return jdbcClient.sql("""
                SELECT id, status, announcement_id, message, requested_at, processed_at
                FROM manual_announcement_queue
                ORDER BY requested_at DESC
                LIMIT :limit
                """)
                .param("limit", Math.min(Math.max(limit, 1), 100))
                .query(AnnouncementAdminController::map)
                .list();
    }

    private void requireRegion(String guName) {
        if (guName.isBlank()) {
            throw new ApiException(ErrorCode.INVALID_REGION, "자치구(guName)가 필요합니다.");
        }
        int found = jdbcClient.sql("SELECT count(*) FROM region_code WHERE gu_name = :gu")
                .param("gu", guName)
                .query(Integer.class)
                .single();
        if (found == 0) {
            throw new ApiException(ErrorCode.INVALID_REGION, "지원하지 않는 자치구입니다: " + guName);
        }
    }

    private static LocalDate parseDate(String value, String field) {
        String v = trim(value);
        if (v.isBlank()) {
            return null;
        }
        try {
            return LocalDate.parse(v);
        } catch (DateTimeParseException e) {
            throw new ApiException(ErrorCode.INVALID_DATE_RANGE, field + "는 YYYY-MM-DD 형식이어야 합니다.");
        }
    }

    private static String trim(String s) {
        return s == null ? "" : s.trim();
    }

    private static QueueItem map(ResultSet rs, int rowNum) throws SQLException {
        return new QueueItem(
                rs.getLong("id"),
                rs.getString("status"),
                rs.getObject("announcement_id", Long.class),
                rs.getString("message"),
                rs.getObject("requested_at", OffsetDateTime.class),
                rs.getObject("processed_at", OffsetDateTime.class));
    }

    public record AnnouncementCommand(
            String title,
            String supplyType,
            String guName,
            String dongName,
            String applyStart,
            String applyEnd,
            String winnerDate,
            String contractDate,
            String sourceUrl,
            List<Unit> units) {}

    public record Unit(String houseType, Double areaM2, Integer supplyCount, Long supplyAmountManwon) {}

    public record QueueItem(
            long id, String status, Long announcementId, String message,
            OffsetDateTime requestedAt, OffsetDateTime processedAt) {}
}

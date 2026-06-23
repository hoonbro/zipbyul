package com.jipbyul.api.admin;

import com.jipbyul.api.admin.dto.CollectionJob;
import com.jipbyul.api.common.ApiException;
import com.jipbyul.api.common.ErrorCode;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Set;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/** 내부용 — 운영자가 수집 배치를 수동 큐잉. collector 스케줄러가 PENDING 행을 폴링·실행한다. */
@RestController
@RequestMapping("/internal/admin/collect")
public class CollectionJobController {

    private static final Set<String> ALLOWED = Set.of("applyhome", "lh", "molit", "ecos");

    private final JdbcClient jdbcClient;

    public CollectionJobController(JdbcClient jdbcClient) {
        this.jdbcClient = jdbcClient;
    }

    @PostMapping
    public CollectionJob enqueue(@RequestBody CollectCommand command) {
        String source = command.source() == null ? "" : command.source().trim();
        if (!ALLOWED.contains(source)) {
            throw new ApiException(ErrorCode.INVALID_ENUM,
                    "source는 applyhome/lh/molit/ecos 중 하나여야 합니다.");
        }
        return jdbcClient.sql("""
                INSERT INTO collection_job (source, status)
                VALUES (:source, 'PENDING')
                RETURNING id, source, status, requested_at, started_at, finished_at, message
                """)
                .param("source", source)
                .query(CollectionJobController::map)
                .single();
    }

    @GetMapping("/jobs")
    public List<CollectionJob> jobs(@RequestParam(defaultValue = "20") int limit) {
        return jdbcClient.sql("""
                SELECT id, source, status, requested_at, started_at, finished_at, message
                FROM collection_job
                ORDER BY requested_at DESC
                LIMIT :limit
                """)
                .param("limit", Math.min(Math.max(limit, 1), 100))
                .query(CollectionJobController::map)
                .list();
    }

    private static CollectionJob map(ResultSet rs, int rowNum) throws SQLException {
        return new CollectionJob(
                rs.getLong("id"),
                rs.getString("source"),
                rs.getString("status"),
                rs.getObject("requested_at", OffsetDateTime.class),
                rs.getObject("started_at", OffsetDateTime.class),
                rs.getObject("finished_at", OffsetDateTime.class),
                rs.getString("message"));
    }

    public record CollectCommand(String source) {}
}

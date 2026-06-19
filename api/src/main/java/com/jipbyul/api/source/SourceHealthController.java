package com.jipbyul.api.source;

import com.jipbyul.api.source.dto.SourceHealthItem;
import java.time.OffsetDateTime;
import java.util.List;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/internal/source-health")
public class SourceHealthController {

    private final JdbcClient jdbcClient;

    public SourceHealthController(JdbcClient jdbcClient) {
        this.jdbcClient = jdbcClient;
    }

    @GetMapping
    public List<SourceHealthItem> list() {
        return jdbcClient.sql("""
                SELECT sr.source_code, sr.name, sr.grade,
                       sh.last_success_at, sh.last_failure_at, sh.last_failure_reason,
                       COALESCE(sh.recent_collect_count, 0) AS recent_collect_count,
                       COALESCE(sh.display_available, true) AS display_available
                FROM source_registry sr
                LEFT JOIN source_health_status sh ON sh.source_code = sr.source_code
                ORDER BY sr.grade, sr.source_code
                """)
                .query((rs, n) -> new SourceHealthItem(
                        rs.getString("source_code"),
                        rs.getString("name"),
                        rs.getString("grade"),
                        rs.getObject("last_success_at", OffsetDateTime.class),
                        rs.getObject("last_failure_at", OffsetDateTime.class),
                        rs.getString("last_failure_reason"),
                        rs.getInt("recent_collect_count"),
                        rs.getBoolean("display_available")))
                .list();
    }
}

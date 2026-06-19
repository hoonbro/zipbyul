package com.jipbyul.api.notification;

import java.util.List;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** 미처리 이벤트를 트랜잭션 안에서 FOR UPDATE SKIP LOCKED로 클레임한다(다중 워커 안전). */
@Service
public class OutboxClaimer {

    private final JdbcClient jdbcClient;
    private final int batchSize;

    public OutboxClaimer(JdbcClient jdbcClient,
                         @Value("${notification.consumer.batch-size:100}") int batchSize) {
        this.jdbcClient = jdbcClient;
        this.batchSize = batchSize;
    }

    @Transactional
    public List<OutboxEvent> claim() {
        List<OutboxEvent> events = jdbcClient.sql("""
                SELECT id, event_type, ref_type, ref_id, gu_name, base_score
                FROM domain_event
                WHERE status = 'NEW' AND scheduled_at <= now()
                ORDER BY created_at
                LIMIT :batch
                FOR UPDATE SKIP LOCKED
                """)
                .param("batch", batchSize)
                .query((rs, n) -> new OutboxEvent(
                        rs.getLong("id"), rs.getString("event_type"), rs.getString("ref_type"),
                        rs.getLong("ref_id"), rs.getString("gu_name"), rs.getInt("base_score")))
                .list();
        for (OutboxEvent e : events) {
            jdbcClient.sql("UPDATE domain_event SET status='CLAIMED', claimed_at=now() WHERE id=:id")
                    .param("id", e.id()).update();
        }
        return events;
    }
}

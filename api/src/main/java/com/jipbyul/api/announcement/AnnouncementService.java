package com.jipbyul.api.announcement;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.jipbyul.api.announcement.dto.AnnouncementDetail;
import com.jipbyul.api.announcement.dto.AnnouncementListResponse;
import com.jipbyul.api.announcement.dto.AnnouncementSummary;
import com.jipbyul.api.common.ApiException;
import com.jipbyul.api.common.ErrorCode;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Map;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.jdbc.core.simple.JdbcClient.StatementSpec;
import org.springframework.stereotype.Service;

@Service
public class AnnouncementService {

    private final JdbcClient jdbcClient;
    private final ObjectMapper objectMapper;

    public AnnouncementService(JdbcClient jdbcClient, ObjectMapper objectMapper) {
        this.jdbcClient = jdbcClient;
        this.objectMapper = objectMapper;
    }

    public AnnouncementListResponse list(String region, String supplyType, int page, int size) {
        if (region != null && !region.isBlank()) {
            requireRegion(region);
        }
        String filter = " WHERE 1 = 1"
                + (region != null && !region.isBlank() ? " AND ha.gu_name = :region" : "")
                + (supplyType != null && !supplyType.isBlank() ? " AND ha.supply_type = :supplyType" : "");

        StatementSpec countSpec = bindFilters(
                jdbcClient.sql("SELECT count(*) FROM housing_announcements ha" + filter),
                region, supplyType);
        long total = countSpec.query(Long.class).single();

        StatementSpec listSpec = bindFilters(jdbcClient.sql("""
                SELECT ha.id, ha.pblanc_no, ha.title, ha.supply_type, ha.gu_name,
                       ha.apply_start, ha.apply_end, ha.winner_announce_date,
                       ha.source_url, sr.name AS source_name
                FROM housing_announcements ha
                JOIN source_registry sr ON sr.source_code = ha.source_code
                """ + filter + """
                 ORDER BY ha.apply_end DESC NULLS LAST, ha.id DESC
                 LIMIT :size OFFSET :offset
                """), region, supplyType)
                .param("size", size)
                .param("offset", (long) page * size);

        List<AnnouncementSummary> items = listSpec.query((rs, n) -> new AnnouncementSummary(
                rs.getLong("id"),
                rs.getString("pblanc_no"),
                rs.getString("title"),
                rs.getString("supply_type"),
                rs.getString("gu_name"),
                rs.getObject("apply_start", LocalDate.class),
                rs.getObject("apply_end", LocalDate.class),
                rs.getObject("winner_announce_date", LocalDate.class),
                rs.getString("source_name"),
                rs.getString("source_url"))).list();

        return new AnnouncementListResponse(items, page, size, total);
    }

    public AnnouncementDetail detail(long id) {
        return jdbcClient.sql("""
                SELECT ha.id, ha.pblanc_no, ha.title, ha.supply_type, ha.gu_name, ha.bjd_code,
                       ha.apply_start, ha.apply_end, ha.winner_announce_date, ha.contract_date,
                       ha.source_url, ha.summary_json, ha.collected_at, ha.updated_at,
                       sr.name AS source_name
                FROM housing_announcements ha
                JOIN source_registry sr ON sr.source_code = ha.source_code
                WHERE ha.id = :id
                """)
                .param("id", id)
                .query((rs, n) -> new AnnouncementDetail(
                        rs.getLong("id"),
                        rs.getString("pblanc_no"),
                        rs.getString("title"),
                        rs.getString("supply_type"),
                        rs.getString("gu_name"),
                        rs.getString("bjd_code"),
                        rs.getObject("apply_start", LocalDate.class),
                        rs.getObject("apply_end", LocalDate.class),
                        rs.getObject("winner_announce_date", LocalDate.class),
                        rs.getObject("contract_date", LocalDate.class),
                        rs.getString("source_name"),
                        rs.getString("source_url"),
                        parseJson(rs.getString("summary_json")),
                        rs.getObject("collected_at", OffsetDateTime.class),
                        rs.getObject("updated_at", OffsetDateTime.class)))
                .optional()
                .orElseThrow(() -> new ApiException(ErrorCode.ANNOUNCEMENT_NOT_FOUND));
    }

    private StatementSpec bindFilters(StatementSpec spec, String region, String supplyType) {
        if (region != null && !region.isBlank()) {
            spec = spec.param("region", region);
        }
        if (supplyType != null && !supplyType.isBlank()) {
            spec = spec.param("supplyType", supplyType);
        }
        return spec;
    }

    private Map<String, Object> parseJson(String json) {
        if (json == null || json.isBlank()) {
            return Map.of();
        }
        try {
            return objectMapper.readValue(json, new TypeReference<Map<String, Object>>() {});
        } catch (Exception e) {
            return Map.of();
        }
    }

    private void requireRegion(String guName) {
        int found = jdbcClient.sql("SELECT count(*) FROM region_code WHERE gu_name = :gu")
                .param("gu", guName)
                .query(Integer.class)
                .single();
        if (found == 0) {
            throw new ApiException(ErrorCode.INVALID_REGION, "지원하지 않는 자치구입니다: " + guName);
        }
    }
}

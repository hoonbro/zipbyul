package com.jipbyul.api.calendar;

import com.jipbyul.api.calendar.dto.CalendarItemDto;
import com.jipbyul.api.common.ApiException;
import com.jipbyul.api.common.ErrorCode;
import com.jipbyul.api.common.Times;
import com.jipbyul.api.margin.SafetyMarginService;
import com.jipbyul.api.margin.dto.AnnouncementMargin;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Map;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.jdbc.core.simple.JdbcClient.StatementSpec;
import org.springframework.stereotype.Service;

@Service
public class CalendarService {

    private final JdbcClient jdbcClient;
    private final SafetyMarginService marginService;

    public CalendarService(JdbcClient jdbcClient, SafetyMarginService marginService) {
        this.jdbcClient = jdbcClient;
        this.marginService = marginService;
    }

    public List<CalendarItemDto> find(LocalDate from, LocalDate to, String eventType, String region) {
        if (from.isAfter(to)) {
            throw new ApiException(ErrorCode.INVALID_DATE_RANGE, "from은 to보다 이전이어야 합니다.");
        }
        if (region != null && !region.isBlank()) {
            requireRegion(region);
        }

        StringBuilder sql = new StringBuilder("""
                SELECT ci.id, ci.ref_type, ci.ref_id, ci.event_type, ci.gu_name, ci.event_date,
                       COALESCE(ha.title, pe.title) AS title,
                       ha.supply_type,
                       COALESCE(ha.source_url, sr.base_url) AS source_url,
                       sr.name AS source_name
                FROM calendar_items ci
                LEFT JOIN housing_announcements ha
                       ON ci.ref_type = 'ANNOUNCEMENT' AND ha.id = ci.ref_id
                LEFT JOIN policy_events pe
                       ON ci.ref_type = 'POLICY' AND pe.id = ci.ref_id
                LEFT JOIN source_registry sr ON sr.source_code = COALESCE(ha.source_code, pe.source_code)
                WHERE ci.event_date BETWEEN :from AND :to
                """);
        if (eventType != null && !eventType.isBlank()) {
            sql.append(" AND ci.event_type = :eventType");
        }
        if (region != null && !region.isBlank()) {
            sql.append(" AND ci.gu_name = :region");
        }
        sql.append(" ORDER BY ci.event_date, ci.event_type");

        StatementSpec spec = jdbcClient.sql(sql.toString()).param("from", from).param("to", to);
        if (eventType != null && !eventType.isBlank()) {
            spec = spec.param("eventType", eventType);
        }
        if (region != null && !region.isBlank()) {
            spec = spec.param("region", region);
        }

        LocalDate today = Times.today();
        List<CalendarItemDto> items = spec.query((rs, n) -> {
            LocalDate eventDate = rs.getObject("event_date", LocalDate.class);
            return new CalendarItemDto(
                    rs.getLong("id"),
                    rs.getString("ref_type"),
                    rs.getLong("ref_id"),
                    rs.getString("event_type"),
                    rs.getString("gu_name"),
                    eventDate,
                    ChronoUnit.DAYS.between(today, eventDate),
                    rs.getString("title"),
                    rs.getString("supply_type"),
                    rs.getString("source_name"),
                    rs.getString("source_url"),
                    null, null, null);
        }).list();

        List<Long> announcementIds = items.stream()
                .filter(it -> "ANNOUNCEMENT".equals(it.refType()))
                .map(CalendarItemDto::refId)
                .distinct()
                .toList();
        Map<Long, AnnouncementMargin> margins = marginService.compute(announcementIds);

        return items.stream().map(it -> {
            AnnouncementMargin m = margins.get(it.refId());
            if (m == null || !"ANNOUNCEMENT".equals(it.refType())) {
                return it;
            }
            return it.withMargin(m.representativeGrade(), m.priceCap(), m.unranked());
        }).toList();
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

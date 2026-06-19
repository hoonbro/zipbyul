package com.jipbyul.api.user;

import com.jipbyul.api.common.ApiException;
import com.jipbyul.api.common.ErrorCode;
import com.jipbyul.api.user.dto.PreferencesRequest;
import com.jipbyul.api.user.dto.PreferencesResponse;
import com.jipbyul.api.user.dto.WatchRegionDto;
import java.sql.Array;
import java.time.LocalTime;
import java.util.Arrays;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class PreferencesService {

    private static final LocalTime DEFAULT_DIGEST_TIME = LocalTime.of(8, 0);

    private final JdbcClient jdbcClient;
    private final AnonymousUserService anonymousUserService;

    public PreferencesService(JdbcClient jdbcClient, AnonymousUserService anonymousUserService) {
        this.jdbcClient = jdbcClient;
        this.anonymousUserService = anonymousUserService;
    }

    @Transactional
    public PreferencesResponse get(UUID anonymousId) {
        anonymousUserService.requireActive(anonymousId);
        return load(anonymousId);
    }

    @Transactional
    public PreferencesResponse update(UUID anonymousId, PreferencesRequest req) {
        anonymousUserService.requireActive(anonymousId);

        List<WatchRegionDto> regions = req.watchRegions() == null ? List.of() : req.watchRegions();
        validateRegions(regions);

        String typesLiteral = toArrayLiteral(req.interestTypes());

        jdbcClient.sql("""
                INSERT INTO user_preferences
                    (anonymous_id, alert_level, interest_types, tx_alert_optin,
                     daily_digest_enabled, daily_digest_time, dnd_start, dnd_end, updated_at)
                VALUES
                    (:id, :alertLevel, :types::varchar[], :txOptin,
                     :digestEnabled, :digestTime::time, :dndStart::time, :dndEnd::time, now())
                ON CONFLICT (anonymous_id) DO UPDATE SET
                    alert_level = excluded.alert_level,
                    interest_types = excluded.interest_types,
                    tx_alert_optin = excluded.tx_alert_optin,
                    daily_digest_enabled = excluded.daily_digest_enabled,
                    daily_digest_time = excluded.daily_digest_time,
                    dnd_start = excluded.dnd_start,
                    dnd_end = excluded.dnd_end,
                    updated_at = now()
                """)
                .param("id", anonymousId)
                .param("alertLevel", req.alertLevel().name())
                .param("types", typesLiteral)
                .param("txOptin", req.txAlertOptin() != null && req.txAlertOptin())
                .param("digestEnabled", req.dailyDigestEnabled() == null || req.dailyDigestEnabled())
                .param("digestTime", req.dailyDigestTime() == null ? DEFAULT_DIGEST_TIME : req.dailyDigestTime())
                .param("dndStart", req.dndStart())
                .param("dndEnd", req.dndEnd())
                .update();

        replaceWatchRegions(anonymousId, regions);
        return load(anonymousId);
    }

    private PreferencesResponse load(UUID anonymousId) {
        List<WatchRegionDto> regions = jdbcClient.sql(
                        "SELECT gu_name, bjd_code FROM user_watch_regions WHERE anonymous_id = :id ORDER BY id")
                .param("id", anonymousId)
                .query((rs, n) -> new WatchRegionDto(rs.getString("gu_name"), rs.getString("bjd_code")))
                .list();

        return jdbcClient.sql("""
                SELECT alert_level, interest_types, tx_alert_optin, daily_digest_enabled,
                       daily_digest_time, dnd_start, dnd_end, updated_at
                FROM user_preferences WHERE anonymous_id = :id
                """)
                .param("id", anonymousId)
                .query((rs, n) -> {
                    Array arr = rs.getArray("interest_types");
                    List<String> types = arr == null
                            ? List.of()
                            : Arrays.asList((String[]) arr.getArray());
                    return new PreferencesResponse(
                            anonymousId,
                            rs.getString("alert_level"),
                            types,
                            rs.getBoolean("tx_alert_optin"),
                            rs.getBoolean("daily_digest_enabled"),
                            rs.getObject("daily_digest_time", LocalTime.class),
                            rs.getObject("dnd_start", LocalTime.class),
                            rs.getObject("dnd_end", LocalTime.class),
                            regions,
                            rs.getObject("updated_at", java.time.OffsetDateTime.class));
                })
                .single();
    }

    private void replaceWatchRegions(UUID anonymousId, List<WatchRegionDto> regions) {
        jdbcClient.sql("DELETE FROM user_watch_regions WHERE anonymous_id = :id")
                .param("id", anonymousId)
                .update();
        Set<WatchRegionDto> unique = new LinkedHashSet<>(regions);
        for (WatchRegionDto region : unique) {
            jdbcClient.sql(
                    "INSERT INTO user_watch_regions (anonymous_id, gu_name, bjd_code) VALUES (:id, :gu, :bjd)")
                    .param("id", anonymousId)
                    .param("gu", region.guName())
                    .param("bjd", blankToNull(region.bjdCode()))
                    .update();
        }
    }

    private void validateRegions(List<WatchRegionDto> regions) {
        if (regions.isEmpty()) {
            return;
        }
        Set<String> validGu = new LinkedHashSet<>(jdbcClient.sql(
                        "SELECT DISTINCT gu_name FROM region_code WHERE is_active")
                .query(String.class)
                .list());
        for (WatchRegionDto region : regions) {
            if (!validGu.contains(region.guName())) {
                throw new ApiException(ErrorCode.INVALID_REGION,
                        "지원하지 않는 자치구입니다: " + region.guName());
            }
            String bjd = blankToNull(region.bjdCode());
            if (bjd != null) {
                int found = jdbcClient.sql("SELECT count(*) FROM region_code WHERE bjd_code = :bjd")
                        .param("bjd", bjd)
                        .query(Integer.class)
                        .single();
                if (found == 0) {
                    throw new ApiException(ErrorCode.INVALID_REGION,
                            "지원하지 않는 법정동코드입니다: " + bjd);
                }
            }
        }
    }

    private String toArrayLiteral(List<InterestType> types) {
        if (types == null || types.isEmpty()) {
            return "{}";
        }
        return "{" + types.stream().map(Enum::name).collect(Collectors.joining(",")) + "}";
    }

    private String blankToNull(String s) {
        return (s == null || s.isBlank()) ? null : s;
    }
}

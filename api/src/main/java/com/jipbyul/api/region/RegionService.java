package com.jipbyul.api.region;

import com.jipbyul.api.common.ApiException;
import com.jipbyul.api.common.ErrorCode;
import com.jipbyul.api.region.dto.RegionItem;
import java.util.List;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Service;

@Service
public class RegionService {

    private final JdbcClient jdbcClient;

    public RegionService(JdbcClient jdbcClient) {
        this.jdbcClient = jdbcClient;
    }

    /** 자치구 하위 법정동(동) 목록. 구 레벨 행(dong_name NULL)은 제외. */
    public List<RegionItem> dongs(String guName) {
        if (guName == null || guName.isBlank()) {
            throw new ApiException(ErrorCode.INVALID_REGION, "자치구(gu)가 필요합니다.");
        }
        List<RegionItem> items = jdbcClient.sql("""
                SELECT bjd_code, gu_name, dong_name FROM region_code
                WHERE gu_name = :gu AND dong_name IS NOT NULL AND is_active
                ORDER BY dong_name
                """)
                .param("gu", guName)
                .query((rs, n) -> new RegionItem(
                        rs.getString("bjd_code"), rs.getString("gu_name"), rs.getString("dong_name")))
                .list();
        if (items.isEmpty()) {
            throw new ApiException(ErrorCode.INVALID_REGION, "지원하지 않는 자치구입니다: " + guName);
        }
        return items;
    }
}

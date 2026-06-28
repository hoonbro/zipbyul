package com.jipbyul.api.complex;

import com.jipbyul.api.complex.dto.ComplexSearchItem;
import java.time.LocalDate;
import java.util.List;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Service;

/**
 * 단지 검색 — 단지 레지스트리가 없어 실거래(real_estate_transactions)에서 DISTINCT 단지를 도출한다.
 * complex_norm 정규화는 V10 함수형 인덱스/안전마진 매칭과 동일 규칙(공백·괄호·숫자·'차' 제거).
 */
@Service
public class ComplexService {

    private static final int LIMIT = 30;
    private static final String NORM = "regexp_replace(complex_name, '[[:space:]()0-9차]', '', 'g')";

    private final JdbcClient jdbcClient;

    public ComplexService(JdbcClient jdbcClient) {
        this.jdbcClient = jdbcClient;
    }

    public List<ComplexSearchItem> search(String guName, String query) {
        String like = "%" + (query == null ? "" : query.trim()) + "%";
        return jdbcClient.sql("""
                SELECT %s AS complex_norm,
                       max(complex_name) AS display_name,
                       gu_name,
                       count(*) AS tx_count,
                       max(contract_date) AS last_contract_date
                FROM real_estate_transactions
                WHERE gu_name = :gu
                  AND complex_name IS NOT NULL
                  AND %s <> ''
                  AND complex_name ILIKE :like
                GROUP BY 1, gu_name
                ORDER BY tx_count DESC
                LIMIT %d
                """.formatted(NORM, NORM, LIMIT))
                .param("gu", guName)
                .param("like", like)
                .query((rs, n) -> new ComplexSearchItem(
                        rs.getString("complex_norm"),
                        rs.getString("display_name"),
                        rs.getString("gu_name"),
                        rs.getLong("tx_count"),
                        rs.getObject("last_contract_date", LocalDate.class)))
                .list();
    }
}

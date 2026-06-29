package com.jipbyul.api.complex.dto;

import com.jipbyul.api.transaction.dto.RecentTransactionsResponse;
import java.util.List;

public record ComplexDetail(
        String complexNorm,
        String displayName,
        String guName,
        Integer buildYear,
        List<TrendPoint> saleTrend,
        List<BandSummary> bandSummary,
        List<RecentTransactionsResponse.Item> recentTransactions) {

    /** 매매 월별 중위가(평형대별). */
    public record TrendPoint(String areaBand, String month, long medianManwon, long count) {}

    /** 평형대별 매매·전세 최근 중위가 + 전세가율·갭. */
    public record BandSummary(
            String areaBand,
            Long saleMedianManwon,
            Long jeonseMedianManwon,
            Double jeonseRatio,
            Long gapManwon,
            long saleCount,
            long jeonseCount) {}
}

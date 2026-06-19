package com.jipbyul.api.feed.dto;

import com.jipbyul.api.marketindex.dto.MarketOutlookCard;
import com.jipbyul.api.transaction.dto.RecentTransactionsResponse.Item;
import com.jipbyul.api.watch.dto.RegionSummaryItem;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

public record FeedHomeResponse(
        LocalDate baseDate,
        UserCard user,
        MarketOutlookCard marketOutlook,
        List<UrgentEvent> urgentEvents,
        List<RegionSummaryItem> regionSummary,
        List<Item> recentTransactions,
        DataFreshness dataFreshness) {

    public record UserCard(UUID anonymousId, List<String> watchRegions, List<String> interestTypes) {}

    public record UrgentEvent(
            long eventId,
            String eventType,
            String title,
            String regionName,
            LocalDate eventDate,
            long dDay,
            int baseScore,
            int stars,
            String sourceName) {}

    public record DataFreshness(
            OffsetDateTime lastSuccessfulCollectAt,
            boolean hasPartialFailure,
            List<String> notices) {}
}

package com.jipbyul.api.transaction;

import com.jipbyul.api.transaction.dto.RecentTransactionsResponse;
import java.time.LocalDate;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/v1/transactions")
public class TransactionController {

    private final TransactionService service;

    public TransactionController(TransactionService service) {
        this.service = service;
    }

    @GetMapping("/recent")
    public RecentTransactionsResponse recent(
            @RequestParam(required = false) String region,
            @RequestParam(required = false) String dong,
            @RequestParam(required = false) String bjdCode,
            @RequestParam(required = false) String tradeType,
            @RequestParam(required = false) Double areaMin,
            @RequestParam(required = false) Double areaMax,
            @RequestParam(required = false) Long priceMin,
            @RequestParam(required = false) Long priceMax,
            @RequestParam(required = false) Integer floorMin,
            @RequestParam(required = false) Integer floorMax,
            @RequestParam(required = false) Integer buildYearMin,
            @RequestParam(required = false) Integer buildYearMax,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate contractFrom,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate contractTo,
            @RequestParam(required = false) Integer recentDays,
            @RequestParam(defaultValue = "20") int limit) {
        int bounded = Math.min(Math.max(limit, 1), 100);
        Integer boundedRecentDays = recentDays == null ? null : Math.min(Math.max(recentDays, 1), 30);
        var filter = new TransactionFilter(region, dong, bjdCode, tradeType, areaMin, areaMax,
                priceMin, priceMax, floorMin, floorMax, buildYearMin, buildYearMax,
                contractFrom, contractTo, boundedRecentDays);
        return service.recent(filter, bounded);
    }
}

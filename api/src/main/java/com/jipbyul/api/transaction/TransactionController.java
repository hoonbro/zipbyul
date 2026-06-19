package com.jipbyul.api.transaction;

import com.jipbyul.api.transaction.dto.RecentTransactionsResponse;
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
            @RequestParam(defaultValue = "20") int limit) {
        int bounded = Math.min(Math.max(limit, 1), 100);
        return service.recent(region, dong, bjdCode, bounded);
    }
}

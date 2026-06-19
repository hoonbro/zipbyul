package com.jipbyul.api.marketindex;

import com.jipbyul.api.marketindex.dto.HousePriceOutlookResponse;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/v1/market-index")
public class MarketIndexController {

    private final MarketIndexService service;

    public MarketIndexController(MarketIndexService service) {
        this.service = service;
    }

    @GetMapping("/house-price-outlook")
    public HousePriceOutlookResponse housePriceOutlook() {
        return service.housePriceOutlook();
    }
}

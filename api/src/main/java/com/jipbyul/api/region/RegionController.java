package com.jipbyul.api.region;

import com.jipbyul.api.region.dto.RegionItem;
import java.util.List;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/v1/regions")
public class RegionController {

    private final RegionService service;

    public RegionController(RegionService service) {
        this.service = service;
    }

    @GetMapping
    public List<RegionItem> dongs(@RequestParam(required = false) String gu) {
        return service.dongs(gu);
    }
}

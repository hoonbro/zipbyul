package com.jipbyul.api.complex;

import com.jipbyul.api.common.ApiException;
import com.jipbyul.api.common.ErrorCode;
import com.jipbyul.api.complex.dto.ComplexSearchItem;
import java.util.List;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/v1/complexes")
public class ComplexController {

    private final ComplexService service;

    public ComplexController(ComplexService service) {
        this.service = service;
    }

    @GetMapping
    public List<ComplexSearchItem> search(
            @RequestParam String gu,
            @RequestParam(required = false) String q) {
        if (gu == null || gu.isBlank()) {
            throw new ApiException(ErrorCode.INVALID_REGION, "자치구(gu)가 필요합니다.");
        }
        return service.search(gu, q);
    }
}

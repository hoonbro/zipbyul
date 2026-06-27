package com.jipbyul.api.margin.dto;

import java.math.BigDecimal;

/** 주택형 단위 안전마진 한 줄. 안전마진 기획안 §5 상세 표. */
public record UnitMargin(
        String houseType,
        BigDecimal areaM2,
        Integer supplyCount,
        Long supplyAmountManwon,
        Long marketMedianManwon,
        Long marginManwon,
        Double marginRatio,
        String grade, // HIGH/MID/LOW/UNAVAILABLE
        long sampleCount) {}

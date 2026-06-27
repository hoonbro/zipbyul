package com.jipbyul.api.margin.dto;

import java.util.List;

/** 공고 단위 안전마진 묶음. 카드(대표 등급·로또 단서)와 상세(주택형 표)가 공유. */
public record AnnouncementMargin(
        long announcementId,
        boolean priceCap,
        boolean unranked,
        String representativeGrade, // 59 규칙으로 뽑은 대표 주택형의 등급
        String basisRegion, // 자치구 (gu_name)
        int basisMonths,
        String basisLevel, // 비교 기준: COMPLEX(같은 단지)/PRESALE(동 분양권)/PRESALE_GU(구 분양권)/DONG(같은 동)/GU(자치구)/null
        List<UnitMargin> units) {}

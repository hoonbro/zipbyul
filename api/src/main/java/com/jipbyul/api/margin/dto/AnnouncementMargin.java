package com.jipbyul.api.margin.dto;

import java.util.List;

/** 공고 단위 안전마진 묶음. 카드(대표 등급·로또 단서)와 상세(주택형 표)가 공유. */
public record AnnouncementMargin(
        long announcementId,
        boolean priceCap,
        boolean unranked,
        String representativeGrade, // 59 규칙으로 뽑은 대표 주택형의 등급
        String basisRegion, // 자치구 (MVP 매칭 단위)
        int basisMonths,
        List<UnitMargin> units) {}

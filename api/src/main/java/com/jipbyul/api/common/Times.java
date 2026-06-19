package com.jipbyul.api.common;

import java.time.LocalDate;
import java.time.ZoneId;

/** 모든 시각 계산은 Asia/Seoul 기준 (백엔드 기획안 11장). */
public final class Times {

    public static final ZoneId KST = ZoneId.of("Asia/Seoul");

    private Times() {}

    public static LocalDate today() {
        return LocalDate.now(KST);
    }
}

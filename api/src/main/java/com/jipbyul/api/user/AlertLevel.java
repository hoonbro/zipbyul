package com.jipbyul.api.user;

/** 알림 강도 (contracts/enums.yaml alert_level, 목업 5종). 기본값 IMPORTANT_ONLY. */
public enum AlertLevel {
    ALL,
    IMPORTANT_ONLY,
    DEADLINE_ONLY,
    REGION_ONLY,
    DAILY_DIGEST_ONLY
}

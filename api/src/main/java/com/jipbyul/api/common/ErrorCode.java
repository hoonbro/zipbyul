package com.jipbyul.api.common;

import org.springframework.http.HttpStatus;

/** 에러 코드 SSOT (백엔드 기획안 4-5). code 문자열은 enum 이름을 그대로 노출한다. */
public enum ErrorCode {
    INVALID_REGION(HttpStatus.BAD_REQUEST, "지원하지 않는 자치구입니다."),
    INVALID_DATE_RANGE(HttpStatus.BAD_REQUEST, "잘못된 기간입니다."),
    INVALID_ENUM(HttpStatus.BAD_REQUEST, "잘못된 요청 값입니다."),
    UNAUTHORIZED(HttpStatus.FORBIDDEN, "권한이 없습니다."),
    ANONYMOUS_USER_NOT_FOUND(HttpStatus.NOT_FOUND, "익명 사용자를 찾을 수 없습니다."),
    DEVICE_NOT_FOUND(HttpStatus.NOT_FOUND, "기기를 찾을 수 없습니다."),
    ANNOUNCEMENT_NOT_FOUND(HttpStatus.NOT_FOUND, "공고를 찾을 수 없습니다."),
    ALREADY_EXISTS(HttpStatus.CONFLICT, "이미 존재합니다."),
    RATE_LIMITED(HttpStatus.TOO_MANY_REQUESTS, "요청이 너무 많습니다."),
    UPSTREAM_UNAVAILABLE(HttpStatus.SERVICE_UNAVAILABLE, "상위 데이터 소스를 사용할 수 없습니다."),
    INTERNAL_ERROR(HttpStatus.INTERNAL_SERVER_ERROR, "내부 오류가 발생했습니다.");

    private final HttpStatus status;
    private final String defaultMessage;

    ErrorCode(HttpStatus status, String defaultMessage) {
        this.status = status;
        this.defaultMessage = defaultMessage;
    }

    public HttpStatus status() {
        return status;
    }

    public String defaultMessage() {
        return defaultMessage;
    }
}

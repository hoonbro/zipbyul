package com.jipbyul.api.common;

/** 공통 에러 envelope (백엔드 기획안 4-5). 모든 에러 응답은 이 형태를 쓴다. */
public record ErrorResponse(Error error) {

    public record Error(String code, String message, String traceId) {}

    public static ErrorResponse of(String code, String message, String traceId) {
        return new ErrorResponse(new Error(code, message, traceId));
    }
}

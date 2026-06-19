package com.jipbyul.api.common;

/** 도메인 계층에서 던지는 표준 예외. GlobalExceptionHandler가 envelope으로 변환한다. */
public class ApiException extends RuntimeException {

    private final transient ErrorCode errorCode;

    public ApiException(ErrorCode errorCode) {
        super(errorCode.defaultMessage());
        this.errorCode = errorCode;
    }

    public ApiException(ErrorCode errorCode, String message) {
        super(message);
        this.errorCode = errorCode;
    }

    public ErrorCode errorCode() {
        return errorCode;
    }
}

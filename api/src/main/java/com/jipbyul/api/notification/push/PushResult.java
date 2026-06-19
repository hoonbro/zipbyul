package com.jipbyul.api.notification.push;

public record PushResult(boolean success, String failureReason) {

    public static PushResult ok() {
        return new PushResult(true, null);
    }

    public static PushResult fail(String reason) {
        return new PushResult(false, reason);
    }
}

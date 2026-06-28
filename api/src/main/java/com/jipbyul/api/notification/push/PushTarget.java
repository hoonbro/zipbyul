package com.jipbyul.api.notification.push;

/** 발송 대상 기기. FCM은 token, WebPush는 endpoint/p256dh/auth를 채운다. */
public record PushTarget(String token, String endpoint, String p256dh, String auth) {

    public static PushTarget fcm(String token) {
        return new PushTarget(token, null, null, null);
    }

    public static PushTarget webpush(String endpoint, String p256dh, String auth) {
        return new PushTarget(null, endpoint, p256dh, auth);
    }
}

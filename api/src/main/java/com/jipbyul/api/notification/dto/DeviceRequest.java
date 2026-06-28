package com.jipbyul.api.notification.dto;

/**
 * 푸시 기기 등록. 채널별로 채우는 필드가 다르다.
 * - FCM: deviceToken
 * - WEBPUSH: endpoint, p256dh, auth (브라우저 PushSubscription)
 * kind 미지정 시 FCM(하위호환).
 */
public record DeviceRequest(
        String kind, String deviceToken, String endpoint, String p256dh, String auth) {}

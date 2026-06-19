package com.jipbyul.api.notification.push;

public interface PushSender {

    /** 단일 기기 토큰으로 푸시 발송. 채널 가용 여부와 무관하게 결과를 반환한다. */
    PushResult send(String deviceToken, String title, String body);

    boolean isEnabled();
}

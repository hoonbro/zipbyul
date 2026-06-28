package com.jipbyul.api.notification.push;

public interface PushSender {

    /** 이 구현이 담당하는 채널. user_devices.kind 와 매칭한다. */
    String channel();

    /** 단일 기기로 푸시 발송. 채널 가용 여부와 무관하게 결과를 반환한다. */
    PushResult send(PushTarget target, String title, String body);

    boolean isEnabled();
}

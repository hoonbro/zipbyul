package com.jipbyul.api.notification;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/** 폴링 워커. notification.consumer.enabled=true 일 때만 활성. */
@Component
@ConditionalOnProperty(name = "notification.consumer.enabled", havingValue = "true")
public class OutboxConsumer {

    private static final Logger log = LoggerFactory.getLogger(OutboxConsumer.class);

    private final NotificationDispatcher dispatcher;

    public OutboxConsumer(NotificationDispatcher dispatcher) {
        this.dispatcher = dispatcher;
    }

    @Scheduled(fixedDelayString = "${notification.consumer.poll-interval-ms:60000}")
    public void poll() {
        int processed = dispatcher.runOnce();
        if (processed > 0) {
            log.info("알림 워커: 이벤트 {}건 처리", processed);
        }
    }
}

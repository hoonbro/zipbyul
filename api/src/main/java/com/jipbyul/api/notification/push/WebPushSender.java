package com.jipbyul.api.notification.push;

import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.annotation.PostConstruct;
import java.security.Security;
import java.util.Map;
import nl.martijndwars.webpush.Notification;
import nl.martijndwars.webpush.PushService;
import nl.martijndwars.webpush.Subscription;
import org.apache.http.HttpResponse;
import org.bouncycastle.jce.provider.BouncyCastleProvider;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

/**
 * 표준 Web Push(VAPID) 발송. iOS PWA는 FCM 웹이 동작하지 않아 이 경로로만 푸시가 도달한다.
 * 키 미설정 시 비활성으로 동작(FCM과 동일 패턴).
 */
@Component
public class WebPushSender implements PushSender {

    private static final Logger log = LoggerFactory.getLogger(WebPushSender.class);

    private final String publicKey;
    private final String privateKey;
    private final String subject;
    private final ObjectMapper objectMapper;
    private volatile PushService pushService;

    public WebPushSender(
            @Value("${webpush.vapid.public-key:}") String publicKey,
            @Value("${webpush.vapid.private-key:}") String privateKey,
            @Value("${webpush.vapid.subject:}") String subject,
            ObjectMapper objectMapper) {
        this.publicKey = publicKey;
        this.privateKey = privateKey;
        this.subject = subject;
        this.objectMapper = objectMapper;
    }

    @PostConstruct
    void init() {
        if (publicKey == null || publicKey.isBlank() || privateKey == null || privateKey.isBlank()) {
            log.warn("WebPush 비활성: webpush.vapid 키 미설정");
            return;
        }
        if (Security.getProvider(BouncyCastleProvider.PROVIDER_NAME) == null) {
            Security.addProvider(new BouncyCastleProvider());
        }
        try {
            String sub = (subject == null || subject.isBlank()) ? "mailto:admin@jipbyul" : subject;
            this.pushService = new PushService(publicKey, privateKey, sub);
            log.info("WebPush 초기화 완료");
        } catch (Throwable e) {  // 의존성 누락(NoClassDefFoundError 등)에도 앱 기동을 막지 않는다
            log.error("WebPush 초기화 실패 — 비활성으로 동작", e);
        }
    }

    @Override
    public String channel() {
        return "WEBPUSH";
    }

    @Override
    public boolean isEnabled() {
        return pushService != null;
    }

    @Override
    public PushResult send(PushTarget target, String title, String body) {
        if (pushService == null) {
            return PushResult.fail("WEBPUSH_DISABLED");
        }
        try {
            String payload = objectMapper.writeValueAsString(Map.of("title", title, "body", body));
            Subscription subscription = new Subscription(
                    target.endpoint(), new Subscription.Keys(target.p256dh(), target.auth()));
            HttpResponse response = pushService.send(new Notification(subscription, payload));
            int status = response.getStatusLine().getStatusCode();
            if (status >= 200 && status < 300) {
                return PushResult.ok();
            }
            return PushResult.fail("HTTP_" + status);
        } catch (Exception e) {
            return PushResult.fail(e.getMessage());
        }
    }
}

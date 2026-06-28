package com.jipbyul.api.notification;

import java.util.Map;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** WebPush 구독에 필요한 VAPID 공개키를 클라이언트에 노출(공개키이므로 인증 불필요). */
@RestController
@RequestMapping("/v1/push")
public class PushKeyController {

    private final String vapidPublicKey;

    public PushKeyController(@Value("${webpush.vapid.public-key:}") String vapidPublicKey) {
        this.vapidPublicKey = vapidPublicKey;
    }

    @GetMapping("/vapid-public-key")
    public Map<String, String> vapidPublicKey() {
        return Map.of("publicKey", vapidPublicKey == null ? "" : vapidPublicKey);
    }
}

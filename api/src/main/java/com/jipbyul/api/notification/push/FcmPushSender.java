package com.jipbyul.api.notification.push;

import com.google.auth.oauth2.GoogleCredentials;
import com.google.firebase.FirebaseApp;
import com.google.firebase.FirebaseOptions;
import com.google.firebase.messaging.FirebaseMessaging;
import com.google.firebase.messaging.Message;
import com.google.firebase.messaging.Notification;
import jakarta.annotation.PostConstruct;
import java.io.FileInputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

@Component
public class FcmPushSender implements PushSender {

    private static final Logger log = LoggerFactory.getLogger(FcmPushSender.class);
    private static final String APP_NAME = "jipbyul-fcm";

    private final String credentialsPath;
    private final String projectId;
    private volatile FirebaseMessaging messaging;

    public FcmPushSender(
            @Value("${fcm.credentials-path:}") String credentialsPath,
            @Value("${fcm.project-id:}") String projectId) {
        this.credentialsPath = credentialsPath;
        this.projectId = projectId;
    }

    @PostConstruct
    void init() {
        if (credentialsPath == null || credentialsPath.isBlank()) {
            log.warn("FCM 비활성: fcm.credentials-path 미설정");
            return;
        }
        Path path = Path.of(credentialsPath);
        if (!Files.exists(path)) {
            log.warn("FCM 비활성: 서비스계정 파일 없음 ({})", path.toAbsolutePath());
            return;
        }
        try (FileInputStream in = new FileInputStream(path.toFile())) {
            FirebaseOptions.Builder options = FirebaseOptions.builder()
                    .setCredentials(GoogleCredentials.fromStream(in));
            if (projectId != null && !projectId.isBlank()) {
                options.setProjectId(projectId);
            }
            FirebaseApp app = FirebaseApp.getApps().stream()
                    .filter(a -> APP_NAME.equals(a.getName()))
                    .findFirst()
                    .orElseGet(() -> FirebaseApp.initializeApp(options.build(), APP_NAME));
            this.messaging = FirebaseMessaging.getInstance(app);
            log.info("FCM 초기화 완료 (project={})", projectId);
        } catch (Exception e) {
            log.error("FCM 초기화 실패 — 비활성으로 동작", e);
        }
    }

    @Override
    public String channel() {
        return "FCM";
    }

    @Override
    public boolean isEnabled() {
        return messaging != null;
    }

    @Override
    public PushResult send(PushTarget target, String title, String body) {
        if (messaging == null) {
            return PushResult.fail("FCM_DISABLED");
        }
        try {
            Message message = Message.builder()
                    .setToken(target.token())
                    .setNotification(Notification.builder().setTitle(title).setBody(body).build())
                    .build();
            messaging.send(message);
            return PushResult.ok();
        } catch (Exception e) {
            return PushResult.fail(e.getMessage());
        }
    }
}

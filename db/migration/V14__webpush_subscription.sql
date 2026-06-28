-- 집별 V14 — WebPush(표준 Web Push) 구독정보. iOS PWA는 FCM 웹이 안 붙어 직접 WebPush가 유일한 경로다.
-- 기존 FCM 기기는 device_token 단일 토큰, WebPush 기기는 endpoint/p256dh/auth 구독정보를 쓴다.
-- PushSender 추상화에 채널(kind)로 분기하므로 같은 user_devices에 공존시킨다.

ALTER TABLE user_devices
  ADD COLUMN kind     varchar(10) NOT NULL DEFAULT 'FCM',  -- FCM | WEBPUSH
  ADD COLUMN endpoint varchar(500),
  ADD COLUMN p256dh   varchar(200),
  ADD COLUMN auth     varchar(100);

-- WebPush 기기는 FCM 토큰이 없다 → NULL 허용. (UNIQUE(device_token)는 NULL 다중행 허용)
ALTER TABLE user_devices ALTER COLUMN device_token DROP NOT NULL;

-- WebPush 구독 dedup: 같은 endpoint 재구독 시 갱신(부분 유니크).
CREATE UNIQUE INDEX uq_user_devices_endpoint ON user_devices(endpoint) WHERE endpoint IS NOT NULL;

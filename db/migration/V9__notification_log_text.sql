-- 집별 V9 — 앱 내 알림센터용 표시 텍스트 보존.
-- 발송 시점에 디스패처가 만든 제목/본문을 로그에 함께 저장한다(원천 엔티티가 바뀌어도 이력 표시 유지).
ALTER TABLE notification_logs ADD COLUMN title varchar(120);
ALTER TABLE notification_logs ADD COLUMN body  varchar(300);

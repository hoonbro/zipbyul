-- notification_logs를 DND 지연/하루요약 전달 큐로 함께 사용한다.
-- PENDING -> CLAIMED -> SENT/FAILED 상태로 진행하며 실제 전달 전에는 sent_at이 NULL이다.

ALTER TABLE notification_logs
  ADD COLUMN available_at timestamptz,
  ADD COLUMN claimed_at timestamptz;

ALTER TABLE notification_logs
  ALTER COLUMN sent_at DROP NOT NULL,
  ALTER COLUMN sent_at DROP DEFAULT;

CREATE INDEX idx_notification_delivery_due
  ON notification_logs(status, available_at)
  WHERE status = 'PENDING';

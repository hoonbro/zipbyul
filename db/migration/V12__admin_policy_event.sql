-- 집별 V12 — 백오피스 1차: 운영자 수동 정책 일정 입력 골격.
-- 비기준금리 정책(청약제도 변경 등)은 공식 API가 없어(C등급) 운영자가 콘솔로 수동 등록한다.
-- 기존 운영자 인증(/internal/* + X-Internal-Token)과 policy_events/calendar_items를 재사용.

-- policy_events.source_code FK 대상. 수동 입력 출처를 단일 소스로 등록.
INSERT INTO source_registry (source_code, name, grade, collect_type, license, base_url)
VALUES ('ADMIN_MANUAL', '운영자 수동 입력', 'C', 'MANUAL', '운영자 검수', NULL)
ON CONFLICT (source_code) DO NOTHING;

-- 정책 발표는 원문(보도자료·고시) 링크가 핵심 → 정책 이벤트에 출처 URL 신설.
ALTER TABLE policy_events ADD COLUMN source_url varchar(500);

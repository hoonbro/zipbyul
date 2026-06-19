-- 한국은행 2026년 통화정책방향 결정회의 8회.
-- 출처: 한국은행 공보 2025-10-24호(2025-10-30 발표).

INSERT INTO source_registry (source_code, name, grade, collect_type, license, base_url)
VALUES (
    'BOK_MPC', '한국은행 금융통화위원회', 'A', 'SEED', '공식 공개 일정',
    'https://www.bok.or.kr/portal/main/contents.do?menuNo=200755'
)
ON CONFLICT (source_code) DO NOTHING;

INSERT INTO policy_events
    (source_code, event_type, title, event_date, is_seoul_wide, dedup_hash)
VALUES
    ('BOK_MPC', 'RATE_DECISION', '한국은행 기준금리 결정', DATE '2026-01-15', true,
     md5('BOK_RATE_DECISION_2026-01-15') || md5('BOK_RATE_DECISION_2026-01-15')),
    ('BOK_MPC', 'RATE_DECISION', '한국은행 기준금리 결정', DATE '2026-02-26', true,
     md5('BOK_RATE_DECISION_2026-02-26') || md5('BOK_RATE_DECISION_2026-02-26')),
    ('BOK_MPC', 'RATE_DECISION', '한국은행 기준금리 결정', DATE '2026-04-10', true,
     md5('BOK_RATE_DECISION_2026-04-10') || md5('BOK_RATE_DECISION_2026-04-10')),
    ('BOK_MPC', 'RATE_DECISION', '한국은행 기준금리 결정', DATE '2026-05-28', true,
     md5('BOK_RATE_DECISION_2026-05-28') || md5('BOK_RATE_DECISION_2026-05-28')),
    ('BOK_MPC', 'RATE_DECISION', '한국은행 기준금리 결정', DATE '2026-07-16', true,
     md5('BOK_RATE_DECISION_2026-07-16') || md5('BOK_RATE_DECISION_2026-07-16')),
    ('BOK_MPC', 'RATE_DECISION', '한국은행 기준금리 결정', DATE '2026-08-27', true,
     md5('BOK_RATE_DECISION_2026-08-27') || md5('BOK_RATE_DECISION_2026-08-27')),
    ('BOK_MPC', 'RATE_DECISION', '한국은행 기준금리 결정', DATE '2026-10-22', true,
     md5('BOK_RATE_DECISION_2026-10-22') || md5('BOK_RATE_DECISION_2026-10-22')),
    ('BOK_MPC', 'RATE_DECISION', '한국은행 기준금리 결정', DATE '2026-11-26', true,
     md5('BOK_RATE_DECISION_2026-11-26') || md5('BOK_RATE_DECISION_2026-11-26'))
ON CONFLICT (dedup_hash) DO UPDATE SET
    title = EXCLUDED.title,
    event_date = EXCLUDED.event_date;

INSERT INTO calendar_items (ref_type, ref_id, event_type, gu_name, event_date)
SELECT 'POLICY', pe.id, pe.event_type, NULL, pe.event_date
FROM policy_events pe
WHERE pe.source_code = 'BOK_MPC'
  AND pe.event_type = 'RATE_DECISION'
  AND pe.event_date >= DATE '2026-01-01'
  AND pe.event_date < DATE '2027-01-01'
  AND NOT EXISTS (
      SELECT 1
      FROM calendar_items ci
      WHERE ci.ref_type = 'POLICY'
        AND ci.ref_id = pe.id
        AND ci.event_type = pe.event_type
        AND ci.event_date = pe.event_date
  );

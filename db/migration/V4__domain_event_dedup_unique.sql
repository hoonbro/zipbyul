-- 집별 V4 — domain_event 멱등 발행 보장
-- 문제: emit_event가 ON CONFLICT DO NOTHING을 쓰지만 dedup_hash에 UNIQUE가 없어
--       PK(id) 외 충돌이 발생하지 않아 중복 이벤트가 그대로 INSERT 됨.
-- 조치: 기존 중복을 정리(그룹당 최소 id 유지)한 뒤 dedup_hash에 UNIQUE 부여.
--       NULL dedup_hash는 Postgres에서 서로 distinct로 취급되어 제약에 영향 없음.

DELETE FROM domain_event a
USING domain_event b
WHERE a.dedup_hash IS NOT NULL
  AND a.dedup_hash = b.dedup_hash
  AND a.id > b.id;

ALTER TABLE domain_event
  ADD CONSTRAINT uq_domain_event_dedup UNIQUE (dedup_hash);

-- 집별 V13 — 백오피스 2차: SH 공공임대(청년안심주택·장기전세) 운영자 수동 입력 큐.
-- 쓰기 경계 유지: Spring 콘솔은 이 큐에만 INSERT하고, 공고 본체(housing_announcements/
-- announcement_unit/calendar_items/domain_event)는 수집기(Python)가 큐를 드레인하며 기존
-- upsert_announcement 경로로 적재한다. (collection_job 폴링 패턴과 동일)

CREATE TABLE manual_announcement_queue (
  id              bigserial PRIMARY KEY,
  payload         jsonb NOT NULL,                  -- {title, supplyType, guName, dongName, applyStart, applyEnd, winnerDate, contractDate, sourceUrl, units:[...]}
  status          varchar(10) NOT NULL DEFAULT 'PENDING',  -- PENDING/DONE/FAILED
  announcement_id bigint,                          -- 처리 결과: 생성/갱신된 housing_announcements.id
  message         varchar(500),                    -- 실패 사유
  requested_at    timestamptz NOT NULL DEFAULT now(),
  processed_at    timestamptz
);
CREATE INDEX idx_manual_ann_pending ON manual_announcement_queue(status, requested_at);

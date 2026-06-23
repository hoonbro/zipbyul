-- 운영자 수기 수집 배치 잡 큐.
-- api(/internal/admin/collect)가 PENDING 행을 넣고, collector 스케줄러가 폴링·실행한다.
CREATE TABLE collection_job (
  id           bigserial   PRIMARY KEY,
  source       varchar(20) NOT NULL,              -- applyhome/lh/molit/ecos
  status       varchar(10) NOT NULL DEFAULT 'PENDING', -- PENDING/RUNNING/SUCCESS/FAILED
  requested_at timestamptz NOT NULL DEFAULT now(),
  started_at   timestamptz,
  finished_at  timestamptz,
  message      varchar(500)
);
CREATE INDEX idx_collection_job_poll ON collection_job(status, requested_at);

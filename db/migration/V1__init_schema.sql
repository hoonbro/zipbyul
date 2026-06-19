-- 집별 V1 초기 스키마 — 백엔드 기획안 7-3 확정 초안
-- 스키마 SSOT. Python(쓰기)·Spring(읽기/알림)이 이 결과를 따른다.
-- 타입·제약은 0주차 PoC 응답 구조 확정 후 미세 조정.

-- ── 소스/지역 메타 ─────────────────────────────
CREATE TABLE source_registry (
  source_code   varchar(40)  PRIMARY KEY,
  name          varchar(100) NOT NULL,
  grade         char(1)      NOT NULL,            -- A/B/C
  collect_type  varchar(10)  NOT NULL,            -- API/RSS/CRAWL/MANUAL/SEED
  license       varchar(200),
  base_url      varchar(300)
);

CREATE TABLE source_health_status (
  source_code         varchar(40) PRIMARY KEY REFERENCES source_registry,
  last_success_at     timestamptz,
  last_failure_at     timestamptz,
  last_failure_reason varchar(300),
  recent_collect_count int DEFAULT 0,
  display_available   boolean DEFAULT true
);

CREATE TABLE region_code (
  bjd_code     char(10) PRIMARY KEY,              -- 법정동코드 10자리
  sigungu_code char(5)  NOT NULL,                 -- 시군구코드(실거래 호출용)
  gu_name      varchar(20) NOT NULL,              -- 자치구명
  dong_name    varchar(40),
  is_active    boolean DEFAULT true
);
CREATE INDEX idx_region_gu ON region_code(gu_name);

-- ── 콘텐츠(정규화, Python 쓰기 / Spring 읽기) ──────
CREATE TABLE housing_announcements (
  id            bigserial PRIMARY KEY,
  source_code   varchar(40) NOT NULL REFERENCES source_registry,
  source_ref_id varchar(80),                      -- pblancNo/공고ID
  pblanc_no     varchar(80),
  title         varchar(300),
  supply_type   varchar(30),                      -- enum SSOT (contracts/enums.yaml)
  gu_name       varchar(20),
  bjd_code      char(10) REFERENCES region_code,
  apply_start   date,
  apply_end     date,
  winner_announce_date date,
  contract_date date,
  source_url    varchar(400),
  summary_json  jsonb,                            -- 구조화 자격/세대 등
  dedup_hash    varchar(64) NOT NULL,
  collected_at  timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (dedup_hash)
);
CREATE INDEX idx_ann_gu_apply ON housing_announcements(gu_name, apply_end);

CREATE TABLE real_estate_transactions (
  id            bigserial PRIMARY KEY,
  source_code   varchar(40) NOT NULL REFERENCES source_registry,
  bjd_code      char(10) NOT NULL REFERENCES region_code,
  gu_name       varchar(20) NOT NULL,
  dong_name     varchar(40),
  complex_name  varchar(120),
  trade_type    varchar(10) NOT NULL,             -- SALE/JEONSE/MONTHLY
  area_m2       numeric(7,2),
  floor         int,
  price_manwon  bigint,                           -- 만원 단위
  contract_date date NOT NULL,
  contract_month char(7),                         -- YYYY-MM
  registered_at date,                             -- API가 줄 때만(보통 NULL)
  first_seen_at timestamptz NOT NULL DEFAULT now(),-- ★ 신규등록 기준
  dedup_hash    varchar(64) NOT NULL,
  collected_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (dedup_hash)
);
CREATE INDEX idx_tx_region_month ON real_estate_transactions(gu_name, contract_month);
CREATE INDEX idx_tx_first_seen   ON real_estate_transactions(gu_name, first_seen_at);

CREATE TABLE policy_events (
  id            bigserial PRIMARY KEY,
  source_code   varchar(40) NOT NULL REFERENCES source_registry,
  event_type    varchar(30) NOT NULL,             -- RATE_DECISION 등
  title         varchar(200) NOT NULL,
  event_date    date NOT NULL,
  is_seoul_wide boolean DEFAULT true,
  dedup_hash    varchar(64) NOT NULL,
  UNIQUE (dedup_hash)
);

CREATE TABLE market_indices (
  index_code  varchar(40) PRIMARY KEY,            -- HOUSE_PRICE_OUTLOOK_SEOUL_CSI
  name        varchar(60) NOT NULL,
  region      varchar(20),                        -- 서울
  source_code varchar(40) NOT NULL REFERENCES source_registry,
  phase       varchar(4) DEFAULT 'MVP'            -- MVP/V2
);
CREATE TABLE market_index_snapshots (
  id           bigserial PRIMARY KEY,
  index_code   varchar(40) NOT NULL REFERENCES market_indices,
  base_month   char(7) NOT NULL,                  -- YYYY-MM
  value        numeric(6,2) NOT NULL,
  band         varchar(20),                       -- 하락/중립/상승 전망 우세
  collected_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (index_code, base_month)
);

CREATE TABLE calendar_items (
  id         bigserial PRIMARY KEY,
  ref_type   varchar(20) NOT NULL,                -- ANNOUNCEMENT/POLICY
  ref_id     bigint NOT NULL,
  event_type varchar(30) NOT NULL,
  gu_name    varchar(20),
  event_date date NOT NULL
);
CREATE INDEX idx_cal_date ON calendar_items(event_date, event_type);

-- ── 아웃박스(이벤트) status 컬럼 포함 ───────────
CREATE TABLE domain_event (
  id           bigserial PRIMARY KEY,
  event_type   varchar(30) NOT NULL,
  ref_type     varchar(20) NOT NULL,
  ref_id       bigint NOT NULL,
  gu_name      varchar(20),
  bjd_code     char(10),
  base_score   int NOT NULL DEFAULT 0,            -- ★ 사용자 독립 점수만
  dedup_hash   varchar(64),
  status       varchar(12) NOT NULL DEFAULT 'NEW',-- NEW/CLAIMED/DONE/FAILED
  retry_count  int NOT NULL DEFAULT 0,
  scheduled_at timestamptz NOT NULL DEFAULT now(),-- D-day 예약 발행
  claimed_at   timestamptz,
  processed_at timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_event_claim ON domain_event(status, scheduled_at);

-- ── 비회원/알림(Spring 쓰기·읽기) ─────────────────
CREATE TABLE anonymous_users (
  anonymous_id uuid PRIMARY KEY,
  status       varchar(10) NOT NULL DEFAULT 'ACTIVE', -- ACTIVE/MERGED/DELETED
  created_at   timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz
);
CREATE TABLE user_preferences (
  anonymous_id   uuid PRIMARY KEY REFERENCES anonymous_users,
  alert_level    varchar(20) NOT NULL DEFAULT 'IMPORTANT_ONLY',
                 -- ALL/IMPORTANT_ONLY/DEADLINE_ONLY/REGION_ONLY/DAILY_DIGEST_ONLY (목업 5종)
  interest_types varchar(30)[] NOT NULL DEFAULT '{}',
                 -- 부록 A interest_type 9종. 청년안심주택·장기전세는 MVP 데이터 없음(개발 예정)
  tx_alert_optin boolean NOT NULL DEFAULT false,  -- 실거래 즉시푸시 옵트인
  daily_digest_enabled boolean DEFAULT true,
  daily_digest_time time DEFAULT '08:00',
  dnd_start time,
  dnd_end   time,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE user_watch_regions (
  id           bigserial PRIMARY KEY,
  anonymous_id uuid NOT NULL REFERENCES anonymous_users,
  gu_name      varchar(20) NOT NULL,
  bjd_code     char(10),                          -- 실거래 좁힘(선택)
  UNIQUE (anonymous_id, gu_name, bjd_code)
);
CREATE TABLE user_devices (
  id              bigserial PRIMARY KEY,
  anonymous_id    uuid NOT NULL REFERENCES anonymous_users,
  device_token    varchar(300) NOT NULL,
  push_enabled    boolean NOT NULL DEFAULT true,
  failure_count   int NOT NULL DEFAULT 0,
  last_success_at timestamptz,
  last_failure_at timestamptz,
  UNIQUE (device_token)
);
CREATE TABLE notification_logs (
  id              bigserial PRIMARY KEY,
  anonymous_id    uuid NOT NULL REFERENCES anonymous_users,
  domain_event_id bigint REFERENCES domain_event,
  channel         varchar(10) NOT NULL,           -- PUSH/IN_APP/DIGEST
  status          varchar(10) NOT NULL,           -- SENT/FAILED/SKIPPED/DEDUPED
  dedup_key       varchar(200) NOT NULL,
  final_score     int,
  sent_at         timestamptz NOT NULL DEFAULT now(),
  UNIQUE (anonymous_id, dedup_key)
);

-- ── 원천/모니터링 ─────────────────────────────────
CREATE TABLE raw_payload (
  id          bigserial PRIMARY KEY,
  source_code varchar(40) NOT NULL,
  payload     jsonb NOT NULL,
  fetched_at  timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE collect_job_log (
  id            bigserial PRIMARY KEY,
  source_code   varchar(40) NOT NULL,
  status        varchar(10) NOT NULL,             -- SUCCESS/FAIL
  fetched_count int,
  failure_reason varchar(300),
  started_at    timestamptz,
  finished_at   timestamptz
);

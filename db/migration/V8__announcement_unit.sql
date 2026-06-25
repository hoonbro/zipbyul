-- 집별 V8 — 안전마진 기획안 §3
-- 공고별 주택형(타입) 단위 분양가 정규화 + 분양가상한제 플래그.
-- Python(쓰기: 청약홈 Mdl) / Spring(읽기: 안전마진 계산)이 따른다.

-- 주택형(타입)은 공고와 1:N (분양가가 타입별로 다름) → 헤더 테이블에 못 넣어 별도 신설.
CREATE TABLE announcement_unit (
  id              bigserial PRIMARY KEY,
  announcement_id bigint NOT NULL REFERENCES housing_announcements,
  house_type      varchar(40),                      -- 주택형 (예: 084.9842A)
  area_m2         numeric(7,2),                     -- 전용면적
  supply_count    int,                              -- 공급세대수
  supply_amount_manwon bigint,                      -- 분양가(기본형, 만원). 옵션·확장 제외
  dedup_hash      varchar(64) NOT NULL,
  collected_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (dedup_hash)
);
CREATE INDEX idx_unit_ann ON announcement_unit(announcement_id);

-- 분양가상한제 = 로또청약 판별의 1차 단서. 공고 헤더로 이미 들어오는 값.
ALTER TABLE housing_announcements ADD COLUMN price_cap_yn boolean;

-- 안전마진 산출(§4): 같은 dong_name + 전용면적 ±5㎡ + 최근 6개월 SALE 중앙값.
-- dong_name 기준 조회를 위한 인덱스(기존 idx_tx_region_month는 gu_name 기준).
CREATE INDEX idx_tx_dong_sale ON real_estate_transactions(dong_name, trade_type, contract_date);

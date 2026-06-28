-- 집별 V16 — 관심단지(관심 아파트 단지). 단지 레지스트리 테이블이 없어 단지는
-- 실거래(real_estate_transactions)의 complex_name으로만 존재하므로, (gu_name, complex_norm)으로 식별한다.
-- complex_norm 규칙은 V10 함수형 인덱스/안전마진 매칭과 동일(공백·괄호·숫자·'차' 제거).
-- display_name은 UI 표시용 대표 원문 단지명.
CREATE TABLE user_watch_complexes (
  id            bigserial PRIMARY KEY,
  anonymous_id  uuid NOT NULL REFERENCES anonymous_users,
  gu_name       varchar(20) NOT NULL,
  complex_norm  varchar(120) NOT NULL,
  display_name  varchar(120) NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (anonymous_id, gu_name, complex_norm)
);
CREATE INDEX idx_watch_complex_anon ON user_watch_complexes(anonymous_id);

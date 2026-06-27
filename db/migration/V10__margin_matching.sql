-- 집별 V10 — 안전마진 매칭 정확도 개선 (신축 보정 + 동/단지 계층 매칭)
-- Python(쓰기) / Spring(읽기: 안전마진 계산)이 공유.

-- 신축 보정(§4 개선): 신축 분양가를 인근 '구축' 중앙값과 비교하면 LOW로 과대판정 →
-- 준신축(build_year 임계 이내) 실거래만 비교하기 위해 연식 컬럼 신설.
ALTER TABLE real_estate_transactions ADD COLUMN build_year smallint;
CREATE INDEX idx_tx_dong_year ON real_estate_transactions(dong_name, trade_type, build_year);

-- 무순위(이미 준공된 단지 재공급) = 같은 단지 실거래 매칭용. 단지명 정규화 함수형 인덱스.
-- 정규화: 공백·괄호·숫자·'차' 제거 (Python 적재 시 complex_norm과 동일 규칙).
CREATE INDEX idx_tx_complex_norm
    ON real_estate_transactions (regexp_replace(complex_name, '[[:space:]()0-9차]', '', 'g'));

-- 공고 측 지오 키: 기존엔 gu_name만 적재 → 동 단위로 좁히지 못함.
-- 주소에서 파싱한 법정동명(실거래 dong_name과 동일 텍스트로 조인)과 정규화 단지명 추가.
ALTER TABLE housing_announcements ADD COLUMN dong_name varchar(40);
ALTER TABLE housing_announcements ADD COLUMN complex_norm varchar(120);

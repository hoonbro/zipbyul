-- 집별 V17 — 실거래 상세 정보 컬럼. 국토부 raw에는 있으나 정규화 안 됐던 필드 추가.
-- 소스별로 제공 여부가 달라 NULL 허용: building_dong(아파트 매매만 aptDong),
-- dealing_type(매매만 dealingGbn 중개/직거래), jibun(대부분), land_area_m2(빌라 매매만 landAr).
ALTER TABLE real_estate_transactions
  ADD COLUMN building_dong varchar(20),
  ADD COLUMN dealing_type  varchar(20),
  ADD COLUMN jibun         varchar(40),
  ADD COLUMN land_area_m2  numeric(10,2);

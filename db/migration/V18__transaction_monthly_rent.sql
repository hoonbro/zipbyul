-- 집별 V18 — 월세 행의 월세액. 기존엔 보증금만 price_manwon에 저장하고 월세(monthlyRent)는
-- 전세/월세 구분에만 쓰고 버려서 UI가 보증금만 노출했다. 월세액을 별도 컬럼으로 보존한다.
-- 매매·전세 행은 NULL.
ALTER TABLE real_estate_transactions
  ADD COLUMN monthly_rent_manwon integer;

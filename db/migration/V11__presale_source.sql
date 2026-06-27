-- 집별 V11 — 분양권/입주권 실거래 소스 등록 (안전마진 신축 동급 비교군).
-- real_estate_transactions.source_code FK 대상이라 적재 전 등록 필요.
INSERT INTO source_registry (source_code, name, grade, collect_type, license, base_url)
VALUES ('MOLIT_APT_PRESALE', '국토부 아파트 분양권/입주권 실거래', 'A', 'API',
        '이용범위 제한 없음', 'https://apis.data.go.kr/1613000/RTMSDataSvcSilvTrade')
ON CONFLICT (source_code) DO NOTHING;

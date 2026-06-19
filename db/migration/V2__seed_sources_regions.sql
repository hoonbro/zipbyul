-- 집별 seed — source_registry, region_code(서울 25구), market_indices
-- Flyway V2: 앱 기동 전 V1 스키마 위에 적재

-- ── source_registry ──────────────────────────────────────────────────────────
INSERT INTO source_registry (source_code, name, grade, collect_type, license, base_url) VALUES
  ('APPLYHOME_APT',    '청약홈 APT 분양정보',          'A', 'API', '자유 활용',             'https://api.odcloud.kr/api/15101046/v1'),
  ('APPLYHOME_UNRANKED','청약홈 무순위·잔여세대',      'A', 'API', '자유 활용',             'https://api.odcloud.kr/api/15128105/v1'),
  ('LH_NOTICE',        'LH 분양임대공고',              'A', 'API', '자유 활용',             'https://apis.data.go.kr/B552555/lhLeaseNoticeInfo1'),
  ('MOLIT_APT_TRADE',  '국토부 아파트 매매 실거래가',  'A', 'API', '이용범위 제한 없음',    'https://apis.data.go.kr/1613000/RTMSDataSvcAptTradeDev'),
  ('MOLIT_APT_RENT',   '국토부 아파트 전월세 실거래가','A', 'API', '이용범위 제한 없음',    'https://apis.data.go.kr/1613000/RTMSDataSvcAptRent'),
  ('MOLIT_VILLA_TRADE','국토부 연립다세대 매매',        'A', 'API', '이용범위 제한 없음',    'https://apis.data.go.kr/1613000/RTMSDataSvcRHTrade'),
  ('MOLIT_VILLA_RENT', '국토부 연립다세대 전월세',      'A', 'API', '이용범위 제한 없음',    'https://apis.data.go.kr/1613000/RTMSDataSvcSHRent'),
  ('MOLIT_OFFI_TRADE', '국토부 오피스텔 매매',          'A', 'API', '이용범위 제한 없음',    'https://apis.data.go.kr/1613000/RTMSDataSvcOffiTrade'),
  ('MOLIT_OFFI_RENT',  '국토부 오피스텔 전월세',        'A', 'API', '이용범위 제한 없음',    'https://apis.data.go.kr/1613000/RTMSDataSvcOffiRent'),
  ('ECOS',             '한국은행 ECOS',                'A', 'API', '출처표시 상업이용 무료', 'https://ecos.bok.or.kr/api')
ON CONFLICT (source_code) DO NOTHING;

-- ── region_code — 서울 25구 (bjd_code = sigungu_code + 00000) ────────────────
INSERT INTO region_code (bjd_code, sigungu_code, gu_name, dong_name, is_active) VALUES
  ('1111000000','11110','종로구',   NULL, true),
  ('1114000000','11140','중구',     NULL, true),
  ('1117000000','11170','용산구',   NULL, true),
  ('1120000000','11200','성동구',   NULL, true),
  ('1121500000','11215','광진구',   NULL, true),
  ('1123000000','11230','동대문구', NULL, true),
  ('1126000000','11260','중랑구',   NULL, true),
  ('1129000000','11290','성북구',   NULL, true),
  ('1130500000','11305','강북구',   NULL, true),
  ('1132000000','11320','도봉구',   NULL, true),
  ('1135000000','11350','노원구',   NULL, true),
  ('1138000000','11380','은평구',   NULL, true),
  ('1141000000','11410','서대문구', NULL, true),
  ('1144000000','11440','마포구',   NULL, true),
  ('1147000000','11470','양천구',   NULL, true),
  ('1150000000','11500','강서구',   NULL, true),
  ('1153000000','11530','구로구',   NULL, true),
  ('1154500000','11545','금천구',   NULL, true),
  ('1156000000','11560','영등포구', NULL, true),
  ('1159000000','11590','동작구',   NULL, true),
  ('1162000000','11620','관악구',   NULL, true),
  ('1165000000','11650','서초구',   NULL, true),
  ('1168000000','11680','강남구',   NULL, true),
  ('1171000000','11710','송파구',   NULL, true),
  ('1174000000','11740','강동구',   NULL, true)
ON CONFLICT (bjd_code) DO NOTHING;

-- ── market_indices ────────────────────────────────────────────────────────────
INSERT INTO market_indices (index_code, name, region, source_code, phase) VALUES
  ('HOUSE_PRICE_OUTLOOK_SEOUL_CSI', '서울 주택가격전망 CSI', '서울', 'ECOS', 'MVP'),
  ('BASE_RATE',                     '기준금리',               NULL,   'ECOS', 'MVP')
ON CONFLICT (index_code) DO NOTHING;

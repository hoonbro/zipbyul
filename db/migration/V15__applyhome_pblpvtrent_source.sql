-- 집별 V15 — 청약홈 공공지원민간임대(청년안심주택) 소스 등록.
-- getPblPvtRentLttotPblancDetail(서비스 15098547, applyhome 어댑터와 같은 서비스키).
-- 청년안심주택은 공공지원민간임대의 부분집합이라 supply_type=YOUTH_SAFE_HOUSE로 매핑한다.
-- 장기전세는 청약홈에 없어(SH 자체 시스템) 수기 큐(manual_announcement_queue)로만 입력된다.
INSERT INTO source_registry (source_code, name, grade, collect_type, license, base_url) VALUES
  ('APPLYHOME_PBLPVTRENT', '청약홈 공공지원민간임대(청년안심주택)', 'A', 'API', '자유 활용',
   'https://api.odcloud.kr/api/ApplyhomeInfoDetailSvc/v1')
ON CONFLICT (source_code) DO NOTHING;

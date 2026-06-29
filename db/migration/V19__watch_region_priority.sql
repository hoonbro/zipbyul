-- 집별 V19 — 관심지역 우선순위. 사용자가 드래그로 정한 자치구 순서를 보존한다.
-- 저장 시 요청 배열 인덱스를 sort_order로 부여, watchRegions/요약/홈 레이더가 이 순서를 따른다.
ALTER TABLE user_watch_regions
  ADD COLUMN sort_order int NOT NULL DEFAULT 0;

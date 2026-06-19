# collector — 수집·정규화·분석 (Python)

공식 공공 API를 주기 폴링해 표준 스키마로 정규화하고, 변화를 감지해 `domain_event`(outbox)를 발행한다. **정규화 테이블의 유일한 writer.** Spring은 읽기만 한다.

## 파이프라인 4단계 (모든 Adapter 공통)
1. **fetch** — 원천 응답을 `raw_payload`에 그대로 저장(감사·재처리). 페이지네이션·지수백오프·트래픽 한도(개발계정 1만/일).
2. **normalize** — 지역(`region_code`)·날짜·공급유형·출처·원문링크를 표준 스키마로 매핑.
3. **dedup** — 멱등 키 해시 upsert(`dedup_hash` UNIQUE). 실거래 신규는 `first_seen_at`로 감지.
4. **emit** — 신규/변경 시 `domain_event(status=NEW, base_score=...)` 발행.

## 디렉토리
- `adapters/` — 청약홈 · LH · 국토부 실거래 · ECOS(서울 CSI·금리)
- `normalize/` — 표준 스키마 변환, dedup, first_seen_at
- `enrich/` — base_score 산정, domain_event 발행
- `scheduler/` — APScheduler/cron 잡 정의 (소스별 격리)
- `fixtures/` — 0주차 PoC 실응답 저장 → 외부 API 없이 normalize→serving 개발/테스트
- `notebooks/` — 0주차 A등급 5개 API 실호출 검증 노트북

enum/코드는 `../contracts/enums.yaml`(부록 A SSOT)을 따른다.

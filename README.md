# 집별 — 서울 부동산 레이더

서울의 청약·공공임대 일정, 기준금리 결정 일정, 관심지역 실거래 신규 등록, 한국은행 서울 주택가격전망 CSI 기반 집값전망 심리를 한곳에 모아 **중요한 변화만 알림으로 전달**하는 비회원 기반 정보 레이더 앱(PWA).

> 매물 검색 앱이 아니라, 놓치지 않게 해주는 알림형 리서치 앱.

## 아키텍처 한 줄 요약

**쓰기 = Python / 읽기 = Spring / 경계 = 공유 PostgreSQL(SSOT)**. 두 스택은 서로를 직접 호출하지 않고 공유 DB가 유일한 계약이다. 스키마는 Flyway 한 곳(`db/`)에서만 관리한다.

```
외부 공공 API (청약홈·LH·국토부 실거래·ECOS)
        │ 폴링
  [collector/]  Python  수집→정규화(dedup/first_seen_at)→분석(base_score)→domain_event 발행
        │ INSERT/UPSERT + outbox
  [db/]  PostgreSQL (SSOT, Flyway 단일 관리)
        │ SELECT / outbox 폴링
  [api/]  Spring  비회원 피드 합성 · 캘린더/공고/실거래/지표 서빙 · outbox 소비 + 사용자별 점수 + FCM/WebPush
        │
  [web/]  PWA 프론트
```

## 디렉토리 구조

| 경로 | 스택 | 역할 | DB 권한 |
| --- | --- | --- | --- |
| `db/` | SQL · Flyway | **스키마 SSOT.** V1 DDL + 시드(region_code·source_registry·기준금리 일정) | — |
| `collector/` | Python | 공공 API 수집·정규화·멱등 적재·base_score 산정·`domain_event` 발행 | 정규화 테이블 **쓰기** |
| `api/` | Spring Boot (Java) | 비회원 홈 피드 합성, 캘린더/공고/실거래/집값전망 서빙, outbox 소비·알림(FCM/WebPush) | 정규화 테이블 **읽기** / `user_*`·`notification_*` 읽기·쓰기 |
| `web/` | PWA | 모바일 프론트(목업 393×852 기준) | — |
| `contracts/` | YAML | **enum/코드 SSOT(부록 A)** + API 응답·에러 계약. Python·Spring·프론트가 동일 코드 문자열 사용 | — |
| `infra/` | Compose·모니터링 | docker-compose, Prometheus/Grafana 설정 | — |
| `docs/` | 문서 | 기획안(planning), 목업(mockup) | — |
| `.github/workflows/` | CI | 모노레포 경로 필터(`api/**`→Spring, `collector/**`→Python) | — |

## 도메인 모듈 (api/)

`user`(비회원 식별자·설정) · `watch`(관심지역) · `calendar` · `announcement`(공고+선택 AI요약) · `policy`(기준금리) · `transaction`(실거래 신규등록) · `marketindex`(집값전망 심리) · `notification`(outbox 소비·점수·발송) · `source`(수집 신뢰성) · `common`(에러 envelope·enum)

## 수집 계층 (collector/)

`adapters`(청약홈·LH·국토부·ECOS) → `normalize`(표준스키마·dedup·first_seen_at) → `enrich`(base_score·domain_event) · `scheduler`(APScheduler/cron) · `fixtures`(PoC 실응답) · `notebooks`(0주차 PoC 검증)

## 시작하기

```bash
cp .env.example .env          # 공공 API 키·FCM·DB 등 채우기
docker compose up -d          # postgres / redis / api / collector
```

## 개발 단계 (백엔드 로드맵)

0. **PoC** — A등급 5개 API 실호출로 가정 검증(실거래 등록일 유무·청약홈 지역필터·LH 지역매칭·서울 CSI 통계코드·호출량), 실응답을 `collector/fixtures/`에 저장
1. 기반 — Flyway V1, region_code/source_registry 시드, enum SSOT 코드화
2. 비회원 개인화 — anonymous_users/preferences/devices/watch_regions, 설정·삭제 API
3. 수집 코어 — 청약홈→LH→실거래→ECOS Adapter, first_seen_at 신규등록 감지, 기준금리 seed
4. 서빙 API — 홈 피드 합성, 캘린더/공고/실거래/지표 API, 성공·에러 계약 고정
5. 데이터 신뢰성 — 출처·기준일·갱신시각·신고지연 고지, 부분 실패 응답
6. 중요도/별점 — base_score(Python) + final_score(Spring) 분리
7. 알림 — outbox consumer(SKIP LOCKED) + fan-out, FCM/WebPush, D-day·하루요약·방해금지
8. 안정화 — 수집 실패 알림, 캐시, dry-run, 베타 배포

상세는 [docs/planning/](docs/planning/) 참고. 모든 시각 기준은 `Asia/Seoul`.

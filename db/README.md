# db — 스키마 SSOT (Flyway 단일 관리)

집별의 유일한 스키마 관리 지점. Python·Spring 양쪽이 이 마이그레이션 결과를 따른다.

- `migration/` — Flyway 마이그레이션. `V1__init_schema.sql`이 첫 마이그레이션(기획안 7-3 확정 초안).
- `seed/` — 정적 시드: `region_code`(행안부 법정동코드), `source_registry`, 기준금리 결정일정(연 8회 내외).

docker compose의 `flyway` 서비스가 앱 기동 전에 `migration/`을 적용한다. 스키마 변경은 항상 여기에 새 버전 파일을 추가하는 방식으로만.

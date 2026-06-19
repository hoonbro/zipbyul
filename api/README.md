# api — 서빙·비회원·알림 (Spring Boot, Java)

공유 PostgreSQL을 **읽어** 비회원 홈 피드를 합성하고, 캘린더/공고/실거래/집값전망을 서빙한다. `domain_event` outbox를 소비해 사용자별 점수를 계산하고 FCM/WebPush로 알림을 발송한다. 정규화 테이블은 읽기 전용, `anonymous_users`/`user_*`/`notification_*`는 읽기·쓰기.

## 도메인 모듈 (src/main/java/com/jipbyul/api/)
user · watch · calendar · announcement · policy · transaction · marketindex · notification · source · common

## 핵심 계약
- 응답·에러 envelope, enum은 `../contracts/`(SSOT)를 따른다.
- 중요도: `final_score = clamp(base_score + personalized_delta, 0, 10)` — base는 domain_event에서 읽고, personalized_delta(관심지역+2/관심유형+2/모두불일치-2)는 발송 시점에 계산(저장 안 함).
- outbox 소비: `@Scheduled` 폴링 + `SELECT ... FOR UPDATE SKIP LOCKED`, `notification_logs` UNIQUE가 발송 멱등성 최종 방어선.
- 모든 시각 계산(D-day·방해금지·요약)은 `Asia/Seoul`.

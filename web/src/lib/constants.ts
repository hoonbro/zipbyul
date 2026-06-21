// enums.yaml(SSOT) 기반 프론트 상수. 코드 문자열은 그대로, 한글은 표시용.

export const SEOUL_GU = [
  '종로구', '중구', '용산구', '성동구', '광진구', '동대문구', '중랑구', '성북구',
  '강북구', '도봉구', '노원구', '은평구', '서대문구', '마포구', '양천구', '강서구',
  '구로구', '금천구', '영등포구', '동작구', '관악구', '서초구', '강남구', '송파구', '강동구',
] as const

export interface InterestTypeOption {
  code: string
  label: string
  /** false면 MVP 데이터 없음(청년안심주택·장기전세) — 선택 비활성 표시. */
  available: boolean
}

export const INTEREST_TYPES: InterestTypeOption[] = [
  { code: 'PRIVATE_SALE_SUB', label: '민간청약', available: true },
  { code: 'UNRANKED_SUB', label: '무순위 청약', available: true },
  { code: 'HAPPY_HOUSE', label: '행복주택', available: true },
  { code: 'PURCHASE_RENTAL', label: '매입임대', available: true },
  { code: 'POLICY_RATE', label: '정책·금리', available: true },
  { code: 'TRANSACTION', label: '실거래 등록', available: true },
  { code: 'HOUSE_PRICE_OUTLOOK', label: '집값 전망 심리', available: true },
  { code: 'YOUTH_SAFE_HOUSE', label: '청년안심주택', available: false },
  { code: 'LONG_TERM_JEONSE', label: '장기전세', available: false },
]

export interface AlertLevelOption {
  code: string
  label: string
  desc: string
}

export const ALERT_LEVELS: AlertLevelOption[] = [
  { code: 'ALL', label: '모든 알림', desc: '관심지역·유형 매칭 전체 즉시' },
  { code: 'IMPORTANT_ONLY', label: '중요 알림만', desc: '별 3개 이상만 즉시' },
  { code: 'DEADLINE_ONLY', label: '마감 임박만', desc: 'D-3·D-1·당일 마감' },
  { code: 'REGION_ONLY', label: '관심지역만', desc: '관심지역 매칭 위주' },
  { code: 'DAILY_DIGEST_ONLY', label: '하루 요약만', desc: '즉시 없이 하루 1회' },
]

export const DEFAULT_ALERT_LEVEL = 'IMPORTANT_ONLY'

export const EVENT_TYPE_LABELS: Record<string, string> = {
  ANNOUNCEMENT_NEW: '신규 공고',
  APPLICATION_START: '접수 시작',
  APPLICATION_DEADLINE: '접수 마감',
  DOCUMENT_SUBMIT: '서류 제출',
  WINNER_ANNOUNCEMENT: '당첨자 발표',
  CONTRACT: '계약',
  RATE_DECISION: '기준금리 결정',
  TRANSACTION_NEW: '실거래 등록',
  MARKET_INDEX_UPDATED: '집값전망 갱신',
}

export const SUPPLY_TYPE_LABELS: Record<string, string> = {
  PRIVATE_SALE: '민간분양',
  UNRANKED: '무순위·잔여',
  OFFICETEL: '오피스텔',
  PUBLIC_SALE: '공공분양',
  HAPPY_HOUSE: '행복주택',
  NATIONAL_RENTAL: '국민임대',
  PURCHASE_RENTAL: '매입임대',
  JEONSE_RENTAL: '전세임대',
}

/** 공고 목록 필터에 노출할 공급유형. */
export const ANNOUNCEMENT_SUPPLY_FILTERS = [
  'PRIVATE_SALE',
  'UNRANKED',
  'PUBLIC_SALE',
  'HAPPY_HOUSE',
  'PURCHASE_RENTAL',
] as const

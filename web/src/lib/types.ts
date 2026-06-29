// 백엔드 응답 타입 (대표 일부). 전체 계약은 contracts/openapi.yaml 참고.
// 추후 openapi-typescript 코드젠으로 대체 가능.

export interface MarketOutlookCard {
  indexCode: string
  name: string
  region: string
  value: number
  band: string
  baseMonth: string
  sourceName: string
  sourceUrl: string | null
  lastCollectedAt: string
  disclaimer: string
}

export interface UrgentEvent {
  eventId: number
  eventType: string
  title: string
  regionName: string | null
  eventDate: string
  dDay: number
  baseScore: number
  stars: number
  sourceName: string | null
}

export interface RegionSummaryItem {
  regionName: string
  announcementCount: number
  deadlineCount: number
  recentTransactionCount: number
}

export interface ComplexSearchItem {
  complexNorm: string
  displayName: string
  guName: string
  transactionCount: number
  lastContractDate: string | null
}

export interface ComplexTrendPoint {
  areaBand: string
  month: string
  medianManwon: number
  count: number
}

export interface ComplexBandSummary {
  areaBand: string
  saleMedianManwon: number | null
  jeonseMedianManwon: number | null
  jeonseRatio: number | null
  gapManwon: number | null
  saleCount: number
  jeonseCount: number
}

export interface ComplexDetail {
  complexNorm: string
  displayName: string
  guName: string
  buildYear: number | null
  saleTrend: ComplexTrendPoint[]
  bandSummary: ComplexBandSummary[]
  recentTransactions: RecentTransaction[]
}

export interface ComplexSummaryItem {
  complexNorm: string
  displayName: string
  guName: string
  recentTransactionCount: number
  latestSalePriceManwon: number | null
  latestSaleContractDate: string | null
  openAnnouncementCount: number
}

export interface DeviceResponse {
  id: number
  deviceToken: string
  pushEnabled: boolean
}

export interface NotificationLogItem {
  id: number
  domainEventId: number | null
  channel: string
  status: string
  finalScore: number | null
  sentAt: string
  title: string | null
  body: string | null
}

export interface RegionItem {
  bjdCode: string
  guName: string
  dongName: string
}

export interface RecentTransaction {
  transactionId: number
  regionName: string
  dong: string | null
  complexName: string | null
  tradeType: string
  areaM2: number | null
  floor: number | null
  priceManwon: number | null
  priceText: string | null
  contractDate: string | null
  contractMonth: string | null
  firstSeenAt: string
  sourceName: string
  buildYear: number | null
  registeredAt: string | null
  buildingDong: string | null
  dealingType: string | null
  jibun: string | null
  landAreaM2: number | null
  monthlyRentManwon: number | null
}

export interface FeedHome {
  baseDate: string
  user: { anonymousId: string; watchRegions: string[]; interestTypes: string[] }
  marketOutlook: MarketOutlookCard | null
  urgentEvents: UrgentEvent[]
  regionSummary: RegionSummaryItem[]
  recentTransactions: RecentTransaction[]
  dataFreshness: {
    lastSuccessfulCollectAt: string | null
    hasPartialFailure: boolean
    notices: string[]
  }
}

export interface HousePriceOutlook {
  indexCode: string
  name: string
  region: string
  current: { baseMonth: string; value: number; band: string; changeFromPrevMonth: number | null }
  history: { baseMonth: string; value: number }[]
  source: { name: string; provider: string; lastCollectedAt: string }
  disclaimer: string
}

export interface CalendarItem {
  eventId: number
  refType: string
  refId: number
  eventType: string
  regionName: string | null
  eventDate: string
  dDay: number
  title: string | null
  supplyType: string | null
  sourceName: string | null
  sourceUrl: string | null
  marginGrade: string | null
  priceCap: boolean | null
  unranked: boolean | null
}

export interface UnitMargin {
  houseType: string | null
  areaM2: number | null
  supplyCount: number | null
  supplyAmountManwon: number | null
  marketMedianManwon: number | null
  marginManwon: number | null
  marginRatio: number | null
  grade: string
  sampleCount: number
}

export interface AnnouncementMargin {
  announcementId: number
  priceCap: boolean
  unranked: boolean
  representativeGrade: string
  basisRegion: string
  basisMonths: number
  basisLevel: string | null
  units: UnitMargin[]
}

export interface AnnouncementSummary {
  id: number
  pblancNo: string | null
  title: string | null
  supplyType: string | null
  regionName: string | null
  applyStart: string | null
  applyEnd: string | null
  winnerAnnounceDate: string | null
  sourceName: string
  sourceUrl: string | null
}

export interface AnnouncementList {
  items: AnnouncementSummary[]
  page: number
  size: number
  totalCount: number
}

export interface AnnouncementDetail extends AnnouncementSummary {
  bjdCode: string | null
  contractDate: string | null
  summary: Record<string, unknown>
  collectedAt: string
  updatedAt: string
  margin: AnnouncementMargin | null
}

export interface Preferences {
  anonymousId: string
  alertLevel: string
  interestTypes: string[]
  txAlertOptin: boolean
  dailyDigestEnabled: boolean
  dailyDigestTime: string | null
  dndStart: string | null
  dndEnd: string | null
  watchRegions: { guName: string; bjdCode: string | null }[]
  updatedAt: string
}

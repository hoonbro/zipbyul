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

// 목업 catColor()·dday() 규칙을 실데이터 라벨에 맞춘 색 헬퍼.

import { EVENT_TYPE_LABELS } from './constants'

export const PALETTE = {
  mint: '#3df5c5',
  amber: '#ffce5a',
  coral: '#ff7b88',
  sky: '#5ba8ff',
  violet: '#9aa7ff',
  muted: '#8a97ab',
} as const

/** 카테고리(공급유형·이벤트유형 라벨)별 색. 미매칭은 muted. */
export function categoryColor(label: string): string {
  if (/금리|정책/.test(label)) return PALETTE.amber
  if (/행복|국민|매입|전세|공공|임대|장기/.test(label)) return PALETTE.sky
  if (/무순위|민간|분양|청약|실거래|오피스텔/.test(label)) return PALETTE.mint
  return PALETTE.muted
}

/** 캘린더 이벤트유형 태그 색 — 시작·신규는 밝게(민트), 마감·제출은 어둡게(슬레이트). */
export function eventTagColor(eventType: string): string {
  switch (eventType) {
    case 'APPLICATION_START':
    case 'ANNOUNCEMENT_NEW':
    case 'TRANSACTION_NEW':
      return '#3df5c5'
    case 'APPLICATION_DEADLINE':
    case 'DOCUMENT_SUBMIT':
      return '#8a97ab'
    case 'WINNER_ANNOUNCEMENT':
    case 'CONTRACT':
      return '#5ba8ff'
    case 'RATE_DECISION':
    case 'MARKET_INDEX_UPDATED':
      return '#ffce5a'
    default:
      return '#8a97ab'
  }
}

/**
 * 이벤트 태그 라벨+색 (캘린더 기준 SSOT). 접수는 진행 중='접수'(민트)·마감='접수 마감'(슬레이트),
 * 그 외는 타입 라벨 + eventTagColor. reception 기본값은 접수마감 타입 단독 판정(레이더용).
 */
export function eventTag(
  eventType: string,
  dDay: number,
  reception = eventType === 'APPLICATION_DEADLINE',
): { label: string; color: string } {
  if (reception) {
    const closed = dDay < 0
    return { label: closed ? '접수 마감' : '접수', color: closed ? '#8a97ab' : '#3df5c5' }
  }
  return { label: EVENT_TYPE_LABELS[eventType] ?? eventType, color: eventTagColor(eventType) }
}

export interface DdayLook {
  text: string
  fg: string
  bg: string
}

/** D-day 숫자 → 표시 텍스트와 색(목업 dday() 규칙). */
export function ddayLook(d: number): DdayLook {
  if (d === 0) return { text: '오늘', fg: '#ff7b88', bg: 'rgba(255,92,108,0.16)' }
  if (d > 0 && d <= 3) return { text: `D-${d}`, fg: '#ffce5a', bg: 'rgba(255,197,61,0.16)' }
  if (d < 0) return { text: `D+${-d}`, fg: '#5a6678', bg: 'rgba(255,255,255,0.06)' }
  return { text: `D-${d}`, fg: '#3df5c5', bg: 'rgba(52,245,197,0.12)' }
}

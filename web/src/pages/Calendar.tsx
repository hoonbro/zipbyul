import { useState } from 'react'
import { Link } from 'react-router-dom'
import DDayBadge from '../components/DDayBadge'
import { ddayLook, eventTagColor } from '../lib/colors'
import { EVENT_TYPE_LABELS } from '../lib/constants'
import { useCalendar } from '../lib/hooks'
import type { CalendarItem } from '../lib/types'

const WEEK = ['일', '월', '화', '수', '목', '금', '토']
const GROUPS = ['전체', '청약', '공공임대', '정책·금리'] as const
const GROUP_COLOR: Record<string, string> = { 청약: '#3df5c5', 공공임대: '#5ba8ff', '정책·금리': '#ffce5a' }

const PERIODS = ['지난주', '어제', '오늘', '내일', '이번주', '다음주'] as const
type Period = (typeof PERIODS)[number]
const isWeekPeriod = (p: Period) => p === '지난주' || p === '이번주' || p === '다음주'

const pad = (n: number) => String(n).padStart(2, '0')
const toISO = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n)

const now = new Date()
const TODAY = new Date(now.getFullYear(), now.getMonth(), now.getDate())
const TODAY_ISO = toISO(TODAY)
const WEEK_START = addDays(TODAY, -TODAY.getDay()) // 일요일 시작
// D-Day 뷰는 지난주~다음주 범위를 한 번에 받아 클라에서 기간 필터
const DDAY_FROM = toISO(addDays(WEEK_START, -7))
const DDAY_TO = toISO(addDays(WEEK_START, 13))

function periodRange(p: Period): [string, string] {
  switch (p) {
    case '지난주':
      return [toISO(addDays(WEEK_START, -7)), toISO(addDays(WEEK_START, -1))]
    case '어제':
      return [toISO(addDays(TODAY, -1)), toISO(addDays(TODAY, -1))]
    case '오늘':
      return [TODAY_ISO, TODAY_ISO]
    case '내일':
      return [toISO(addDays(TODAY, 1)), toISO(addDays(TODAY, 1))]
    case '이번주':
      return [toISO(WEEK_START), toISO(addDays(WEEK_START, 6))]
    case '다음주':
      return [toISO(addDays(WEEK_START, 7)), toISO(addDays(WEEK_START, 13))]
  }
}

function dateDivider(iso: string): { text: string; color: string } {
  const [y, m, d] = iso.split('-').map(Number)
  const dow = new Date(y, m - 1, d).getDay()
  const color = dow === 0 ? '#ff7b88' : dow === 6 ? '#5ba8ff' : '#cdd7e4'
  return { text: `${m}월 ${d}일 (${WEEK[dow]})${iso === TODAY_ISO ? ' · 오늘' : ''}`, color }
}

/** 이벤트를 목업 그룹(청약/공공임대/정책·금리)으로 분류. 미매칭은 null(전체에서만 노출). */
function itemGroup(it: CalendarItem): string | null {
  if (it.eventType === 'RATE_DECISION' || it.eventType === 'MARKET_INDEX_UPDATED') return '정책·금리'
  const s = it.supplyType ?? ''
  if (/HAPPY_HOUSE|NATIONAL_RENTAL|PURCHASE_RENTAL|JEONSE_RENTAL/.test(s)) return '공공임대'
  if (/PRIVATE_SALE|UNRANKED|OFFICETEL|PUBLIC_SALE/.test(s)) return '청약'
  return null
}

type DisplayEvent = CalendarItem & {
  /** 같은 공고의 접수시작이 마감 카드에 흡수됐을 때의 접수 정보 */
  apply?: { startDday: number; startDate: string; sameDay: boolean; ongoing: boolean }
}

/** 같은 공고의 접수시작+접수마감을 한 '접수' 카드(마감일 기준)로 병합. */
function buildDisplay(items: CalendarItem[]): DisplayEvent[] {
  const startByRef = new Map<string, CalendarItem>()
  const deadlineRefs = new Set<string>()
  for (const it of items) {
    const key = `${it.refType}:${it.refId}`
    if (it.eventType === 'APPLICATION_START') startByRef.set(key, it)
    else if (it.eventType === 'APPLICATION_DEADLINE') deadlineRefs.add(key)
  }
  const out: DisplayEvent[] = []
  for (const it of items) {
    const key = `${it.refType}:${it.refId}`
    if (it.eventType === 'APPLICATION_START' && deadlineRefs.has(key)) continue // 마감 카드에 흡수
    if (it.eventType === 'APPLICATION_DEADLINE') {
      const start = startByRef.get(key)
      if (start) {
        out.push({
          ...it,
          apply: {
            startDday: start.dDay,
            startDate: start.eventDate,
            sameDay: start.eventDate === it.eventDate,
            ongoing: start.dDay <= 0 && it.dDay >= 0,
          },
        })
        continue
      }
    }
    out.push(it)
  }
  return out
}

const ddText = (n: number) => (n === 0 ? '오늘' : n > 0 ? `D-${n}` : `D+${-n}`)

const chipCls = 'rounded-md bg-mint/15 px-1.5 py-0.5 text-[10px] font-bold text-mint'

function Badge({ c }: { c: DisplayEvent }) {
  const a = c.apply
  if (a?.sameDay) {
    return (
      <>
        <DDayBadge dDay={c.dDay} />
        <span className={chipCls}>당일접수</span>
      </>
    )
  }
  if (a && a.startDday > 0) {
    const look = ddayLook(c.dDay)
    return (
      <span className="whitespace-nowrap rounded-lg px-2.5 py-1 font-mono text-xs font-bold" style={{ color: look.fg, background: look.bg }}>
        {ddText(a.startDday)} ~ {ddText(c.dDay)}
      </span>
    )
  }
  return (
    <>
      <DDayBadge dDay={c.dDay} />
      {a?.ongoing && <span className={chipCls}>접수중</span>}
    </>
  )
}

function EventCard({ c }: { c: DisplayEvent }) {
  const isAnn = c.refType === 'ANNOUNCEMENT' && c.refId != null
  const isReception = c.apply != null
  const tagColor = isReception ? '#3df5c5' : eventTagColor(c.eventType)
  const tagLabel = isReception ? '접수' : EVENT_TYPE_LABELS[c.eventType] ?? c.eventType
  const dateText = c.apply && !c.apply.sameDay ? `${c.apply.startDate.slice(5)} ~ ${c.eventDate.slice(5)}` : c.eventDate.slice(5)
  const cardCls = `flex items-stretch gap-3 rounded-[15px] border border-white/[0.06] bg-surface p-3.5${c.dDay < 0 ? ' opacity-60' : ''}`
  const inner = (
    <>
      <span className="w-[3px] shrink-0 rounded-full" style={{ background: GROUP_COLOR[itemGroup(c) ?? ''] ?? '#8a97ab' }} />
      <div className="min-w-0 flex-1">
        <div className="mb-1 flex items-center gap-1.5">
          <span className="inline-block whitespace-nowrap rounded-md px-2 py-0.5 text-[11px] font-bold" style={{ color: tagColor, background: `${tagColor}22` }}>
            {tagLabel}
          </span>
          {c.regionName && <span className="text-xs text-muted-2">{c.regionName}</span>}
        </div>
        <div className="mb-1.5 truncate text-[15px] font-semibold">{c.title ?? '(제목 없음)'}</div>
        <div className="flex items-center gap-2 text-[11px] text-muted">
          <span className="font-mono">{dateText}</span>
          {c.sourceName && <span className="text-muted-2">· {c.sourceName}</span>}
        </div>
      </div>
      <div className="flex flex-col items-end justify-center gap-1">
        <Badge c={c} />
      </div>
    </>
  )
  return isAnn ? (
    <Link to={`/announcements/${c.refId}`} className={`${cardCls} active:bg-surface-2`}>
      {inner}
    </Link>
  ) : (
    <div className={cardCls}>{inner}</div>
  )
}

export default function Calendar() {
  const [view, setView] = useState<'month' | 'dday'>('month')
  const [y, setY] = useState(now.getFullYear())
  const [m, setM] = useState(now.getMonth() + 1)
  const [selDay, setSelDay] = useState(now.getDate())
  const [group, setGroup] = useState<(typeof GROUPS)[number]>('전체')
  const [period, setPeriod] = useState<Period>('이번주')

  const daysInMonth = new Date(y, m, 0).getDate()
  const from = view === 'month' ? `${y}-${pad(m)}-01` : DDAY_FROM
  const to = view === 'month' ? `${y}-${pad(m)}-${pad(daysInMonth)}` : DDAY_TO
  const { data, isLoading, isError } = useCalendar({ from, to })

  const filtered = buildDisplay(data ?? []).filter((it) => group === '전체' || itemGroup(it) === group)

  // ---- 월간 ----
  const ymStr = `${y}-${pad(m)}`
  const dotsByDay = new Map<number, Set<string>>()
  for (const it of filtered) {
    if (it.eventDate.slice(0, 7) !== ymStr) continue
    const day = Number(it.eventDate.slice(8, 10))
    const c = GROUP_COLOR[itemGroup(it) ?? ''] ?? '#8a97ab'
    if (!dotsByDay.has(day)) dotsByDay.set(day, new Set())
    dotsByDay.get(day)!.add(c)
  }
  const offset = new Date(y, m - 1, 1).getDay()
  const isCurrentMonth = y === now.getFullYear() && m === now.getMonth() + 1
  const monthList = filtered.filter(
    (it) => it.eventDate.slice(0, 7) === ymStr && Number(it.eventDate.slice(8, 10)) === selDay,
  )
  const selWeekday = WEEK[new Date(y, m - 1, selDay).getDay()]

  // ---- D-Day ----
  const [pStart, pEnd] = periodRange(period)
  const ddayList = filtered
    .filter((it) => it.eventDate >= pStart && it.eventDate <= pEnd)
    .sort((a, b) => a.eventDate.localeCompare(b.eventDate))
  const ddayGroups: { date: string; items: DisplayEvent[] }[] = []
  for (const it of ddayList) {
    const last = ddayGroups[ddayGroups.length - 1]
    if (last && last.date === it.eventDate) last.items.push(it)
    else ddayGroups.push({ date: it.eventDate, items: [it] })
  }

  const shift = (delta: number) => {
    const d = new Date(y, m - 1 + delta, 1)
    setY(d.getFullYear())
    setM(d.getMonth() + 1)
    setSelDay(1)
  }

  const listEmpty = view === 'month' ? monthList.length === 0 : ddayList.length === 0

  return (
    <div className="space-y-4">
      <div className="mt-1.5 flex items-center justify-between">
        <h1 className="text-[21px] font-extrabold tracking-tight">통합 캘린더</h1>
        <div className="flex rounded-[10px] bg-surface-2 p-[3px]">
          {(['month', 'dday'] as const).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setView(v)}
              className={`rounded-lg px-4 py-1.5 text-[13px] font-bold ${view === v ? 'bg-mint text-mint-ink' : 'text-muted'}`}
            >
              {v === 'month' ? '월간' : 'D-Day'}
            </button>
          ))}
        </div>
      </div>

      {/* group filters */}
      <div className="flex gap-2 overflow-x-auto pb-0.5">
        {GROUPS.map((g) => (
          <button
            key={g}
            type="button"
            onClick={() => setGroup(g)}
            className={`shrink-0 whitespace-nowrap rounded-full border px-4 py-2 text-[13px] font-semibold ${
              group === g ? 'border-mint bg-mint text-mint-ink' : 'border-white/10 bg-surface text-muted'
            }`}
          >
            {g}
          </button>
        ))}
      </div>

      {/* period filters (D-Day only) */}
      {view === 'dday' && (
        <div className="flex gap-2 overflow-x-auto pb-0.5">
          {PERIODS.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setPeriod(p)}
              className={`shrink-0 whitespace-nowrap rounded-full border px-3.5 py-1.5 text-[13px] font-semibold ${
                period === p ? 'border-mint/55 bg-mint/15 text-mint' : 'border-white/10 bg-surface text-muted'
              }`}
            >
              {p}
            </button>
          ))}
        </div>
      )}

      {/* month grid */}
      {view === 'month' && (
        <div className="rounded-[18px] border border-white/[0.06] bg-surface p-4">
          <div className="mb-3.5 flex items-center justify-between">
            <button type="button" onClick={() => shift(-1)} className="flex h-[30px] w-[30px] items-center justify-center rounded-[9px] bg-surface-2 text-muted">
              ‹
            </button>
            <span className="text-base font-extrabold">{y}년 {m}월</span>
            <button type="button" onClick={() => shift(1)} className="flex h-[30px] w-[30px] items-center justify-center rounded-[9px] bg-surface-2 text-muted">
              ›
            </button>
          </div>
          <div className="mb-1.5 grid grid-cols-7">
            {WEEK.map((w, i) => (
              <div key={w} className="text-center text-[11px] font-semibold" style={{ color: i === 0 ? '#ff7b88' : i === 6 ? '#5ba8ff' : '#5a6678' }}>
                {w}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-0.5">
            {Array.from({ length: offset }).map((_, i) => (
              <div key={`b${i}`} className="h-[46px]" />
            ))}
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const d = i + 1
              const isSel = d === selDay
              const isToday = isCurrentMonth && d === now.getDate()
              const dots = [...(dotsByDay.get(d) ?? [])].slice(0, 3)
              let cls = 'border-transparent text-muted'
              if (isSel) cls = 'border-mint/50 bg-mint/15 text-mint'
              else if (isToday) cls = 'border-white/15 text-ink'
              return (
                <button
                  key={d}
                  type="button"
                  onClick={() => setSelDay(d)}
                  className={`flex h-[46px] flex-col items-center justify-center gap-[3px] rounded-[11px] border text-[13px] font-semibold ${cls}`}
                >
                  <span>{d}</span>
                  <span className="flex h-1 gap-0.5">
                    {dots.map((c) => (
                      <span key={c} className="h-1 w-1 rounded-full" style={{ background: c }} />
                    ))}
                  </span>
                </button>
              )
            })}
          </div>
          <div className="mt-3.5 flex gap-4 border-t border-white/[0.06] pt-3">
            {Object.entries(GROUP_COLOR).map(([label, c]) => (
              <div key={label} className="flex items-center gap-1.5">
                <span className="h-[7px] w-[7px] rounded-full" style={{ background: c }} />
                <span className="text-[11px] text-muted">{label}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {view === 'month' && <p className="px-0.5 text-sm font-bold text-muted">{`${m}월 ${selDay}일 ${selWeekday}요일`}</p>}

      {isLoading && <p className="text-sm text-muted-2">불러오는 중…</p>}
      {isError && <p className="text-sm text-coral">캘린더를 불러오지 못했습니다.</p>}
      {!isLoading && !isError && listEmpty && (
        <p className="py-8 text-center text-sm text-muted-2">
          {view === 'month' ? '이 날짜에는 일정이 없어요' : `${period}에는 일정이 없어요`}
        </p>
      )}

      {/* month list */}
      {view === 'month' && (
        <ul className="space-y-2.5">
          {monthList.map((c) => (
            <li key={c.eventId}>
              <EventCard c={c} />
            </li>
          ))}
        </ul>
      )}

      {/* D-Day list */}
      {view === 'dday' && isWeekPeriod(period) && (
        <div className="space-y-4">
          {ddayGroups.map((g) => {
            const div = dateDivider(g.date)
            return (
              <div key={g.date} className="space-y-2.5">
                <div className="flex items-center gap-2 px-0.5">
                  <span className="text-sm font-bold" style={{ color: div.color }}>
                    {div.text}
                  </span>
                  <span className="h-px flex-1 bg-white/[0.06]" />
                </div>
                <ul className="space-y-2.5">
                  {g.items.map((c) => (
                    <li key={c.eventId}>
                      <EventCard c={c} />
                    </li>
                  ))}
                </ul>
              </div>
            )
          })}
        </div>
      )}

      {view === 'dday' && !isWeekPeriod(period) && (
        <ul className="space-y-2.5">
          {ddayList.map((c) => (
            <li key={c.eventId}>
              <EventCard c={c} />
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

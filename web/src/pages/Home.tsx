import { useState } from 'react'
import { Link } from 'react-router-dom'
import DDayBadge from '../components/DDayBadge'
import { HomeSkeleton } from '../components/LoadingSkeleton'
import NotificationCenter from '../components/NotificationCenter'
import StarRating from '../components/StarRating'
import { eventTag } from '../lib/colors'
import { useFeedHome, useNotifications } from '../lib/hooks'

const NOTIF_SEEN_KEY = 'jb_notif_last_seen'

function readLastSeen(): number {
  try {
    return Number(localStorage.getItem(NOTIF_SEEN_KEY) ?? 0)
  } catch {
    return 0
  }
}

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토']

function formatBaseDate(s: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s)
  if (!m) return s
  const dt = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
  return `${Number(m[2])}월 ${Number(m[3])}일 ${WEEKDAYS[dt.getDay()]}요일`
}

export default function Home() {
  const { data, isLoading, isError, error } = useFeedHome()
  const { data: notifs } = useNotifications()
  const [centerOpen, setCenterOpen] = useState(false)
  const [lastSeen, setLastSeen] = useState(readLastSeen)
  const [panelSeen, setPanelSeen] = useState(0)

  const maxNotifId = (notifs ?? []).reduce((m, n) => Math.max(m, n.id), 0)
  const hasUnseen = maxNotifId > lastSeen

  const openCenter = () => {
    setPanelSeen(lastSeen)
    setCenterOpen(true)
    if (maxNotifId > lastSeen) {
      setLastSeen(maxNotifId)
      try {
        localStorage.setItem(NOTIF_SEEN_KEY, String(maxNotifId))
      } catch {
        /* noop */
      }
    }
  }

  if (isLoading) return <HomeSkeleton />
  if (isError) return <p className="text-sm text-coral">피드를 불러오지 못했습니다. ({String(error)})</p>
  if (!data) return null

  const scanCount = data.urgentEvents.length + data.recentTransactions.length
  const importantCount = data.urgentEvents.filter((e) => e.stars >= 4).length
  const urgentCount = data.urgentEvents.filter((e) => e.dDay >= 0 && e.dDay <= 3).length

  return (
    <div className="space-y-6">
      {/* top bar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div
            className="relative flex h-[30px] w-[30px] items-center justify-center rounded-[9px] border border-mint/40"
            style={{ background: 'radial-gradient(circle at 50% 50%,#0c3b30,#081d18)' }}
          >
            <span className="h-[5px] w-[5px] rounded-full bg-mint" />
            <span className="absolute h-[5px] w-[5px] rounded-full bg-mint" style={{ animation: 'jb-ping 2s ease-out infinite' }} />
          </div>
          <span className="text-[19px] font-extrabold tracking-tight">집별</span>
        </div>
        <button
          type="button"
          onClick={openCenter}
          aria-label="알림"
          className="relative flex h-[34px] w-[34px] items-center justify-center rounded-[10px] bg-surface-2"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#9aa7ba" strokeWidth="1.8" strokeLinecap="round">
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
            <path d="M13.7 21a2 2 0 0 1-3.4 0" />
          </svg>
          {hasUnseen && (
            <span className="absolute right-2 top-[7px] h-[7px] w-[7px] rounded-full border-[1.5px] border-surface-2 bg-red" />
          )}
        </button>
      </div>

      <NotificationCenter open={centerOpen} onClose={() => setCenterOpen(false)} lastSeenId={panelSeen} />

      {/* radar hero */}
      <div
        className="relative overflow-hidden rounded-[20px] border border-mint/20 p-5"
        style={{ background: 'linear-gradient(135deg,#0c1828,#0a1320)' }}
      >
        <div
          className="pointer-events-none absolute inset-0"
          style={{ background: 'radial-gradient(120% 90% at 85% 30%,rgba(52,245,197,0.12),transparent 60%)' }}
        />
        <div className="relative z-[2] max-w-[200px]">
          <div className="mb-3 font-mono text-[11px] tracking-[0.1em] text-mint">● RADAR · 실시간 스캔</div>
          <div className="mb-1 text-[13px] text-muted">{formatBaseDate(data.baseDate)}</div>
          <div className="text-[27px] font-extrabold leading-tight tracking-tight">
            오늘 <span className="text-mint">{scanCount}</span>건<br />
            스캔 완료
          </div>
          <div className="mt-3 flex gap-2">
            <span className="whitespace-nowrap rounded-lg bg-amber/15 px-2.5 py-1 font-mono text-xs font-bold text-amber">
              중요 {importantCount}건
            </span>
            <span className="whitespace-nowrap rounded-lg bg-red/15 px-2.5 py-1 font-mono text-xs font-bold text-coral">
              마감임박 {urgentCount}
            </span>
          </div>
        </div>
        {/* radar disc */}
        <div className="absolute -right-[34px] top-1/2 z-[1] h-[170px] w-[170px] -translate-y-1/2 rounded-full">
          <div className="absolute inset-0 rounded-full border border-mint/[0.16]" />
          <div className="absolute inset-[26px] rounded-full border border-mint/[0.14]" />
          <div className="absolute inset-[52px] rounded-full border border-mint/[0.12]" />
          <div
            className="absolute inset-0 rounded-full"
            style={{
              background:
                'conic-gradient(from 0deg,rgba(52,245,197,0) 0deg,rgba(52,245,197,0) 280deg,rgba(52,245,197,0.45) 360deg)',
              animation: 'jb-sweep 3.4s linear infinite',
            }}
          />
          <span className="absolute left-[62%] top-[34%] h-1.5 w-1.5 rounded-full bg-mint" style={{ boxShadow: '0 0 8px #3df5c5', animation: 'jb-blip 2.2s ease-in-out infinite' }} />
          <span className="absolute left-[40%] top-[62%] h-[5px] w-[5px] rounded-full bg-amber" style={{ boxShadow: '0 0 8px #ffce5a', animation: 'jb-blip 2.8s ease-in-out infinite .6s' }} />
          <span className="absolute left-[72%] top-[66%] h-1 w-1 rounded-full bg-mint" style={{ animation: 'jb-blip 2.4s ease-in-out infinite 1.1s' }} />
        </div>
      </div>

      {/* 시장 요약 */}
      <section>
        <SectionHead title="시장 요약" to="/market-outlook" linkLabel="지수" />
        <div className="flex gap-2.5">
          {data.marketOutlook ? (
            <Link to="/market-outlook" className="flex-1 rounded-[15px] border border-white/[0.06] bg-surface p-3">
              <div className="mb-2 text-[11px] whitespace-nowrap text-muted-2">집값전망</div>
              <div className="font-mono text-[23px] font-bold leading-none">{data.marketOutlook.value}</div>
              <div className="mt-1.5 text-[11px] font-bold whitespace-nowrap text-mint">{data.marketOutlook.band}</div>
            </Link>
          ) : (
            <SoonCard k="집값전망" />
          )}
          <SoonCard k="시장온도" />
          <SoonCard k="전세온도" />
        </div>
      </section>

      {/* 중요 일정 */}
      <section>
        <SectionHead title="중요 일정" to="/calendar" linkLabel="캘린더" />
        {data.urgentEvents.length === 0 ? (
          <p className="text-xs text-muted-2">표시할 마감 임박 일정이 없습니다.</p>
        ) : (
          <ul className="space-y-2.5">
            {data.urgentEvents.map((e) => {
              const tag = eventTag(e.eventType, e.dDay)
              return (
                <li key={e.eventId} className="flex items-center gap-3 rounded-[15px] border border-white/[0.06] bg-surface p-3.5">
                  <DDayBadge dDay={e.dDay} />
                  <div className="min-w-0 flex-1">
                    <div className="mb-0.5 flex items-center gap-1.5">
                      <span
                        className="inline-block whitespace-nowrap rounded-md px-2 py-0.5 text-[11px] font-bold"
                        style={{ color: tag.color, background: `${tag.color}22` }}
                      >
                        {tag.label}
                      </span>
                      <span className="text-xs text-muted-2">{e.regionName ?? '서울'}</span>
                    </div>
                    <div className="truncate text-[15px] font-semibold">{e.title}</div>
                  </div>
                  <StarRating stars={e.stars} />
                </li>
              )
            })}
          </ul>
        )}
      </section>

      {/* 실거래 + 관심지역 요약 */}
      <div className="flex gap-2.5">
        <Link
          to="/transactions"
          className="flex flex-1 flex-col gap-1.5 rounded-[16px] border border-white/[0.07] bg-surface px-4 py-4"
        >
          <span className="text-[11px] text-muted-2">오늘 새 실거래</span>
          <span className="font-mono text-[26px] font-bold leading-none">{data.recentTransactions.length}</span>
          <span className="text-[11px] font-bold text-sky">관심지역 기준 ›</span>
        </Link>
        <Link
          to="/watch"
          className="flex flex-1 flex-col justify-between gap-2 rounded-[16px] border border-white/[0.07] bg-surface px-4 py-4"
        >
          <span className="text-[11px] text-muted-2">관심지역 움직임</span>
          <span className="text-[15px] font-bold leading-snug">
            {data.regionSummary.length}개 지역<br />
            <span className="text-[13px] font-semibold text-muted">
              신규 공고 {data.regionSummary.reduce((s, r) => s + r.announcementCount, 0)}건
            </span>
          </span>
          <span className="text-[11px] font-bold text-mint">보기 ›</span>
        </Link>
      </div>

      {data.dataFreshness.notices.map((n) => (
        <div key={n} className="flex gap-1.5 px-0.5">
          <span className="text-xs text-muted-2">ⓘ</span>
          <span className="text-xs leading-snug text-muted-2">{n}</span>
        </div>
      ))}

      {/* 오늘의 주요 뉴스 (2차) */}
      <section>
        <div className="mb-3 flex items-center gap-2">
          <h2 className="text-base font-extrabold tracking-tight">오늘의 주요 뉴스</h2>
          <span className="rounded-md border border-violet/30 bg-violet/15 px-2 py-px font-mono text-[10px] font-bold text-violet">개발 예정</span>
        </div>
        <Link to="/news" className="flex items-center gap-3 rounded-[15px] border border-dashed border-violet/30 bg-soon p-4">
          <div className="flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-[11px] bg-violet/15">
            <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="#9aa7ff" strokeWidth="1.8" strokeLinecap="round">
              <rect x="4" y="4" width="16" height="16" rx="2.5" />
              <path d="M8 9h8M8 13h8M8 17h5" />
            </svg>
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-sm font-bold text-ink-2">부동산 뉴스 · AI 요약</div>
            <div className="mt-0.5 text-xs leading-snug text-muted">관심지역 뉴스와 3줄 요약은 2차에서 제공할 예정이에요.</div>
          </div>
          <span className="text-lg text-muted-2">›</span>
        </Link>
      </section>
    </div>
  )
}


function SectionHead({ title, to, linkLabel }: { title: string; to: string; linkLabel: string }) {
  return (
    <div className="mb-3 flex items-center justify-between">
      <h2 className="text-base font-extrabold tracking-tight">{title}</h2>
      <Link to={to} className="text-xs text-muted-2">
        {linkLabel} ›
      </Link>
    </div>
  )
}

function SoonCard({ k }: { k: string }) {
  return (
    <Link to="/market-outlook" className="flex-1 rounded-[15px] border border-dashed border-violet/30 bg-soon p-3">
      <div className="mb-2 flex items-center justify-between gap-1">
        <span className="text-[11px] whitespace-nowrap text-muted-2">{k}</span>
        <span className="rounded-[5px] bg-violet/15 px-1.5 py-px font-mono text-[8px] font-bold text-violet">예정</span>
      </div>
      <div className="font-mono text-[23px] font-bold leading-none text-muted-2">–</div>
      <div className="mt-1.5 text-[11px] font-bold whitespace-nowrap text-violet">개발 예정</div>
    </Link>
  )
}

import { useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import Chip from '../components/Chip'
import { TRADE_TYPE_LABELS } from '../lib/constants'
import { useComplexDetail } from '../lib/hooks'
import type { RecentTransaction } from '../lib/types'

const BAND_ORDER = ['~20평', '20평대', '30평대', '40평대+']

function formatEok(manwon: number | null): string {
  if (manwon == null) return '—'
  if (manwon < 10000) return `${manwon.toLocaleString()}만`
  const eok = Math.floor(manwon / 10000)
  const rest = manwon % 10000
  return rest === 0 ? `${eok}억` : `${eok}억 ${rest.toLocaleString()}만`
}

export default function ComplexDetail() {
  const [sp] = useSearchParams()
  const navigate = useNavigate()
  const gu = sp.get('gu')
  const norm = sp.get('norm')
  const fallbackName = sp.get('name') ?? ''

  const { data, isLoading, isError } = useComplexDetail(gu, norm)

  const bands = useMemo(() => {
    if (!data) return []
    const present = new Set<string>([
      ...data.bandSummary.map((b) => b.areaBand),
      ...data.saleTrend.map((p) => p.areaBand),
    ])
    return BAND_ORDER.filter((b) => present.has(b))
  }, [data])

  const defaultBand = useMemo(() => {
    if (!data || bands.length === 0) return ''
    const top = [...data.bandSummary].sort((a, b) => b.saleCount - a.saleCount)[0]
    return top?.areaBand ?? bands[0]
  }, [data, bands])

  const [band, setBand] = useState<string>('')
  const activeBand = band || defaultBand

  if (isLoading) return <p className="text-sm text-muted-2">불러오는 중…</p>
  if (isError || !data) return <p className="text-sm text-coral">단지 정보를 불러오지 못했습니다.</p>

  const summary = data.bandSummary.find((b) => b.areaBand === activeBand)
  const trend = data.saleTrend.filter((p) => p.areaBand === activeBand)
  const recent = activeBand
    ? data.recentTransactions.filter((t) => bandOf(t.areaM2) === activeBand)
    : data.recentTransactions

  return (
    <div className="space-y-5">
      <button type="button" onClick={() => navigate(-1)} className="text-sm text-muted-2">
        ‹ 뒤로
      </button>

      <header className="mt-0.5">
        <h1 className="text-[21px] font-extrabold tracking-tight">{data.displayName || fallbackName}</h1>
        <p className="mt-1 text-[13px] text-muted">
          {data.guName}
          {data.buildYear != null && ` · ${data.buildYear}년 준공`}
        </p>
      </header>

      {bands.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {bands.map((b) => (
            <Chip key={b} selected={activeBand === b} onClick={() => setBand(b)}>
              {b}
            </Chip>
          ))}
        </div>
      )}

      {/* 평형대 요약 */}
      <section className="grid grid-cols-2 gap-2.5">
        <SummaryCard k="최근 매매 중위" v={formatEok(summary?.saleMedianManwon ?? null)} color="#3df5c5" />
        <SummaryCard k="최근 전세 중위" v={formatEok(summary?.jeonseMedianManwon ?? null)} color="#5ba8ff" />
        <SummaryCard
          k="전세가율"
          v={summary?.jeonseRatio != null ? `${(summary.jeonseRatio * 100).toFixed(0)}%` : '—'}
          color="#ffce5a"
        />
        <SummaryCard k="갭 (매매−전세)" v={formatEok(summary?.gapManwon ?? null)} color="#ff7b88" />
      </section>

      {/* 매매 월별 중위가 추이 */}
      <section className="rounded-[18px] border border-white/[0.06] bg-surface px-4 pb-4 pt-3.5">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-sm font-bold">매매 중위가 추이 {activeBand && `· ${activeBand}`}</span>
          <span className="text-[11px] text-muted-2">최근 12개월</span>
        </div>
        {trend.length === 0 ? (
          <p className="py-8 text-center text-xs text-muted-2">표시할 매매 거래가 없습니다.</p>
        ) : (
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trend} margin={{ top: 8, right: 8, bottom: 0, left: -8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                <XAxis dataKey="month" tick={{ fontSize: 10, fill: '#8a97ab' }} stroke="rgba(255,255,255,0.1)" />
                <YAxis
                  tick={{ fontSize: 10, fill: '#8a97ab' }}
                  stroke="rgba(255,255,255,0.1)"
                  domain={['dataMin - 5000', 'dataMax + 5000']}
                  tickFormatter={(v: number) => `${(v / 10000).toFixed(0)}억`}
                  width={36}
                />
                <Tooltip
                  contentStyle={{ background: '#11192a', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10, fontSize: 12 }}
                  labelStyle={{ color: '#8a97ab' }}
                  formatter={(value) => [formatEok(Number(value)), '중위가']}
                />
                <Line type="monotone" dataKey="medianManwon" stroke="#3df5c5" strokeWidth={2} dot={{ r: 2 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </section>

      {/* 최근 거래 */}
      <section>
        <h2 className="mb-3 text-base font-extrabold tracking-tight">최근 거래</h2>
        {recent.length === 0 ? (
          <p className="text-sm text-muted-2">최근 거래가 없습니다.</p>
        ) : (
          <ul className="space-y-2.5">
            {recent.map((t) => (
              <RecentRow key={t.transactionId} t={t} />
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}

function bandOf(areaM2: number | null): string | null {
  if (areaM2 == null) return null
  if (areaM2 < 66) return '~20평'
  if (areaM2 < 99) return '20평대'
  if (areaM2 < 132) return '30평대'
  return '40평대+'
}

function priceLabel(t: RecentTransaction): string | null {
  if (!t.priceText) return null
  if (t.tradeType === 'MONTHLY' && t.monthlyRentManwon != null) {
    return `${t.priceText} / ${t.monthlyRentManwon.toLocaleString()}만`
  }
  return t.priceText
}

function SummaryCard({ k, v, color }: { k: string; v: string; color: string }) {
  return (
    <div className="rounded-[15px] border border-white/[0.06] bg-surface px-4 py-3">
      <div className="text-[11px] text-muted-2">{k}</div>
      <div className="mt-1 font-mono text-[17px] font-bold" style={{ color }}>
        {v}
      </div>
    </div>
  )
}

function RecentRow({ t }: { t: RecentTransaction }) {
  const c = t.tradeType === 'SALE' ? '#3df5c5' : '#5ba8ff'
  const price = priceLabel(t)
  return (
    <li className="flex items-center gap-3 rounded-[15px] border border-white/[0.06] bg-surface px-4 py-3">
      <span className="shrink-0 rounded-lg px-2.5 py-1.5 text-[11px] font-bold" style={{ color: c, background: `${c}22` }}>
        {TRADE_TYPE_LABELS[t.tradeType] ?? t.tradeType}
      </span>
      <div className="min-w-0 flex-1">
        <div className="text-xs text-muted-2">
          {t.contractDate ?? ''}
          {t.areaM2 != null && ` · ${t.areaM2}㎡`}
          {t.floor != null && ` · ${t.floor}층`}
        </div>
      </div>
      {price && <span className="shrink-0 font-mono text-[14px] font-bold">{price}</span>}
    </li>
  )
}

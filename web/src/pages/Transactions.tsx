import { useState, type ReactNode } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import Chip from '../components/Chip'
import { SEOUL_GU, TRADE_TYPE_LABELS } from '../lib/constants'
import {
  usePreferences,
  useRecentTransactions,
  useRegions,
  type RecentTransactionParams,
} from '../lib/hooks'
import type { RecentTransaction } from '../lib/types'

const PYEONG_TO_M2 = 3.3058

const FLOOR_BAND_RANGE: Record<string, [number, number]> = {
  저층: [1, 5], 중층: [6, 15], 고층: [16, 99],
}

const AREA_QUICK = [
  { label: '전체', lo: 0, hi: 60 },
  { label: '~10평', lo: 0, hi: 10 },
  { label: '10평대', lo: 10, hi: 20 },
  { label: '20평대', lo: 20, hi: 30 },
  { label: '30평대', lo: 30, hi: 40 },
  { label: '40평+', lo: 40, hi: 60 },
]

const BUILT_PRESETS = [
  { label: '전체', v: null as number | null },
  { label: '5년이내', v: 5 },
  { label: '10년이내', v: 10 },
  { label: '15년이내', v: 15 },
  { label: '20년이내', v: 20 },
]

const QUICK_TYPES = [
  { label: '전체', value: '' },
  { label: '매매', value: 'SALE' },
  { label: '전세', value: 'JEONSE' },
  { label: '월세', value: 'MONTHLY' },
]

const FILTER_TYPES = [...QUICK_TYPES, { label: '분양권', value: 'PRESALE' }]

interface TxFilters {
  gu: string
  dong: string
  tradeType: string
  eokMin: number
  eokMax: number
  pyeongMin: number
  pyeongMax: number
  areaUnit: 'pyeong' | 'sqm'
  floorBands: string[]
  builtPreset: number | null
  yearMin: string
  yearMax: string
  dateFrom: string
  dateTo: string
  recentDays: number | null
}

const EMPTY: TxFilters = {
  gu: '', dong: '', tradeType: '',
  eokMin: 0, eokMax: 50,
  pyeongMin: 0, pyeongMax: 60,
  areaUnit: 'pyeong',
  floorBands: [],
  builtPreset: null, yearMin: '', yearMax: '',
  dateFrom: '', dateTo: '',
  recentDays: null,
}

function toParams(f: TxFilters): RecentTransactionParams {
  const areaMin = f.pyeongMin > 0 ? +(f.pyeongMin * PYEONG_TO_M2).toFixed(2) : undefined
  const areaMax = f.pyeongMax < 60 ? +(f.pyeongMax * PYEONG_TO_M2).toFixed(2) : undefined
  const priceMin = f.eokMin > 0 ? Math.round(f.eokMin * 10000) : undefined
  const priceMax = f.eokMax < 50 ? Math.round(f.eokMax * 10000) : undefined

  let floorMin: number | undefined
  let floorMax: number | undefined
  if (f.floorBands.length > 0) {
    const ranges = f.floorBands.map((b) => FLOOR_BAND_RANGE[b])
    floorMin = Math.min(...ranges.map((r) => r[0]))
    floorMax = Math.max(...ranges.map((r) => r[1]))
  }

  let buildYearMin: number | undefined
  let buildYearMax: number | undefined
  if (f.builtPreset != null) {
    buildYearMin = new Date().getFullYear() - f.builtPreset
  } else {
    buildYearMin = f.yearMin ? Number(f.yearMin) : undefined
    buildYearMax = f.yearMax ? Number(f.yearMax) : undefined
  }

  return {
    region: f.gu || undefined,
    dong: f.gu ? f.dong || undefined : undefined,
    tradeType: f.tradeType || undefined,
    areaMin, areaMax, priceMin, priceMax,
    floorMin, floorMax, buildYearMin, buildYearMax,
    contractFrom: f.dateFrom || undefined,
    contractTo: f.dateTo || undefined,
    recentDays: f.recentDays ?? undefined,
  }
}

interface ActiveChip { label: string; clear: () => void }

function computeActiveChips(f: TxFilters, set: (p: Partial<TxFilters>) => void): ActiveChip[] {
  const out: ActiveChip[] = []
  if (f.gu) out.push({ label: f.dong ? `${f.gu} ${f.dong}` : f.gu, clear: () => set({ gu: '', dong: '' }) })
  if (f.eokMin > 0 || f.eokMax < 50) out.push({
    label: `${f.eokMin > 0 ? fmtEok(f.eokMin) : ''}~${f.eokMax < 50 ? fmtEok(f.eokMax) : ''}억`,
    clear: () => set({ eokMin: 0, eokMax: 50 }),
  })
  if (f.pyeongMin > 0 || f.pyeongMax < 60) {
    const conv = (v: number) => f.areaUnit === 'sqm' ? `${Math.round(v * PYEONG_TO_M2)}㎡` : `${v}평`
    out.push({
      label: `${f.pyeongMin > 0 ? conv(f.pyeongMin) : ''}~${f.pyeongMax < 60 ? conv(f.pyeongMax) : ''}`,
      clear: () => set({ pyeongMin: 0, pyeongMax: 60 }),
    })
  }
  if (f.floorBands.length) out.push({ label: f.floorBands.join('·'), clear: () => set({ floorBands: [] }) })
  if (f.builtPreset != null) out.push({ label: `${f.builtPreset}년이내`, clear: () => set({ builtPreset: null }) })
  else if (f.yearMin || f.yearMax) out.push({ label: `준공 ${f.yearMin || ''}~${f.yearMax || ''}`, clear: () => set({ yearMin: '', yearMax: '' }) })
  if (f.dateFrom || f.dateTo) out.push({ label: `계약 ${f.dateFrom || '…'}~${f.dateTo || '…'}`, clear: () => set({ dateFrom: '', dateTo: '' }) })
  if (f.recentDays != null) out.push({ label: `최근 ${f.recentDays}일 등록`, clear: () => set({ recentDays: null }) })
  return out
}

function initialFilters(searchParams: URLSearchParams): TxFilters {
  const recentDays = Number(searchParams.get('recentDays'))
  return {
    ...EMPTY,
    gu: searchParams.get('region') || '',
    dong: searchParams.get('dong') || '',
    tradeType: searchParams.get('tradeType') || '',
    recentDays: Number.isFinite(recentDays) && recentDays > 0 ? recentDays : null,
  }
}

const fmtEok = (v: number) => (Number.isInteger(v) ? String(v) : v.toFixed(1))

// 양방향 슬라이더
const RANGE_CLS = [
  'absolute inset-0 h-full w-full cursor-pointer appearance-none bg-transparent',
  '[&::-webkit-slider-runnable-track]:bg-transparent',
  '[&::-webkit-slider-thumb]:appearance-none',
  '[&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:w-5',
  '[&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:cursor-pointer',
  '[&::-webkit-slider-thumb]:bg-ink',
  '[&::-webkit-slider-thumb]:border-[3px] [&::-webkit-slider-thumb]:border-bg',
  '[&::-webkit-slider-thumb]:shadow-[0_1px_5px_rgba(0,0,0,0.55)]',
  '[&::-moz-range-track]:bg-transparent',
  '[&::-moz-range-thumb]:h-5 [&::-moz-range-thumb]:w-5',
  '[&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:cursor-pointer',
  '[&::-moz-range-thumb]:bg-ink [&::-moz-range-thumb]:appearance-none',
  '[&::-moz-range-thumb]:border-[3px] [&::-moz-range-thumb]:border-bg',
].join(' ')

// 썸(thumb) 반지름 10px → 양 끝에서 잘리지 않도록 수평 패딩 10px 확보
function DualSlider({ min, max, step, lo, hi, onLo, onHi }: {
  min: number; max: number; step: number
  lo: number; hi: number
  onLo: (v: number) => void; onHi: (v: number) => void
}) {
  const range = max - min
  const loPct = range === 0 ? 0 : ((lo - min) / range) * 100
  const hiPct = range === 0 ? 100 : ((hi - min) / range) * 100
  return (
    <div className="relative h-8 select-none px-2.5">
      <div className="pointer-events-none absolute inset-x-2.5 top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-surface-2" />
      <div
        className="pointer-events-none absolute top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-mint"
        style={{ left: `calc(10px + ${loPct}% * (100% - 20px) / 100%)`, right: `calc(10px + ${100 - hiPct}% * (100% - 20px) / 100%)` }}
      />
      <input
        type="range" min={min} max={max} step={step} value={lo}
        onChange={(e) => onLo(Math.min(Number(e.target.value), hi - step))}
        className={RANGE_CLS}
        style={{ zIndex: lo >= max - step ? 5 : 3 }}
      />
      <input
        type="range" min={min} max={max} step={step} value={hi}
        onChange={(e) => onHi(Math.max(Number(e.target.value), lo + step))}
        className={RANGE_CLS}
        style={{ zIndex: 4 }}
      />
    </div>
  )
}

export default function Transactions() {
  const [searchParams] = useSearchParams()
  const prefs = usePreferences()
  const watchGus = [...new Set(prefs.data?.watchRegions.map((r) => r.guName) ?? [])]
  const [filters, setFilters] = useState<TxFilters>(() => initialFilters(searchParams))
  const [filterOpen, setFilterOpen] = useState(false)
  const [selected, setSelected] = useState<RecentTransaction | null>(null)

  const set = (patch: Partial<TxFilters>) => setFilters((f) => ({ ...f, ...patch }))
  const tx = useRecentTransactions(toParams(filters))
  const guOptions = watchGus.length > 0 ? watchGus : [...SEOUL_GU]
  const activeChips = computeActiveChips(filters, set)

  return (
    <div className="space-y-4">
      <h1 className="mt-1.5 text-[21px] font-extrabold tracking-tight">실거래</h1>

      {/* 유형 퀵칩 + 필터 버튼 */}
      <div className="flex items-center gap-2">
        <div className="flex flex-1 gap-1.5 overflow-x-auto [scrollbar-width:none]">
          {QUICK_TYPES.map(({ label, value }) => (
            <button
              key={value}
              type="button"
              onClick={() => set({ tradeType: value })}
              className={`shrink-0 whitespace-nowrap rounded-full border px-4 py-2 text-[13px] font-semibold transition-colors ${
                filters.tradeType === value
                  ? 'border-mint/55 bg-mint/15 text-mint'
                  : 'border-white/10 bg-surface text-muted'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={() => setFilterOpen(true)}
          className="flex shrink-0 items-center gap-1.5 rounded-[12px] border border-white/10 bg-surface px-3.5 py-2 text-[13px] font-bold"
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M4 6h16M7 12h10M10 18h4" />
          </svg>
          필터
          {activeChips.length > 0 && (
            <span className="flex h-[17px] min-w-[17px] items-center justify-center rounded-full bg-mint px-1 font-mono text-[11px] font-bold text-mint-ink">
              {activeChips.length}
            </span>
          )}
        </button>
      </div>

      {/* 활성 필터칩 (개별 ✕ 삭제) */}
      {activeChips.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          {activeChips.map((c) => (
            <button
              key={c.label}
              type="button"
              onClick={c.clear}
              className="inline-flex items-center gap-1.5 rounded-full border border-mint/35 bg-mint/10 px-3 py-1.5 text-[12px] font-semibold text-mint"
            >
              {c.label} <span className="opacity-70">✕</span>
            </button>
          ))}
          <button type="button" onClick={() => setFilters(EMPTY)} className="px-2 py-1 text-[12px] font-semibold text-muted-2 underline">
            초기화
          </button>
        </div>
      )}

      {tx.isLoading && <p className="text-sm text-muted-2">불러오는 중…</p>}
      {tx.data && (
        <p className="text-[13px] text-muted-2">
          총 <span className="font-mono font-bold text-ink">{tx.data.items.length}</span>건
        </p>
      )}
      {tx.data && tx.data.items.length === 0 && (
        <div className="py-10 text-center">
          <p className="text-sm text-muted-2">조건에 맞는 실거래가 없어요</p>
          <button type="button" onClick={() => setFilters(EMPTY)} className="mt-2 text-[13px] font-semibold text-mint">
            필터 초기화
          </button>
        </div>
      )}

      <ul className="space-y-2.5">
        {tx.data?.items.map((t) => (
          <TxRow key={t.transactionId} t={t} onClick={() => setSelected(t)} />
        ))}
      </ul>

      {tx.data?.notice && (
        <div className="flex gap-1.5 px-0.5">
          <span className="text-xs text-muted-2">ⓘ</span>
          <span className="text-xs leading-snug text-muted-2">{tx.data.notice}</span>
        </div>
      )}

      {selected && <TxDetailSheet t={selected} onClose={() => setSelected(null)} />}
      {filterOpen && (
        <FilterSheet
          initial={filters}
          guOptions={guOptions}
          onApply={(next) => { setFilters(next); setFilterOpen(false) }}
          onClose={() => setFilterOpen(false)}
        />
      )}
    </div>
  )
}

function fmtContract(d: string | null): string | null {
  if (!d) return null
  const [, m, day] = d.split('-')
  return m && day ? `${m}.${day}` : d
}

function priceLabel(t: RecentTransaction): string | null {
  if (!t.priceText) return null
  if (t.tradeType === 'MONTHLY' && t.monthlyRentManwon != null) {
    return `${t.priceText} / ${t.monthlyRentManwon.toLocaleString()}만`
  }
  return t.priceText
}

function TxRow({ t, onClick }: { t: RecentTransaction; onClick: () => void }) {
  const c = t.tradeType === 'SALE' ? '#3df5c5' : '#5ba8ff'
  const price = priceLabel(t)
  const contract = fmtContract(t.contractDate)
  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        className="flex w-full items-center gap-3 rounded-[15px] border border-white/[0.06] bg-surface px-4 py-3 text-left transition-colors active:bg-white/[0.04]"
      >
        <span className="shrink-0 rounded-lg px-2.5 py-1.5 text-[11px] font-bold" style={{ color: c, background: `${c}22` }}>
          {TRADE_TYPE_LABELS[t.tradeType] ?? t.tradeType}
        </span>
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-bold">{t.complexName ?? '(단지 미상)'}</div>
          <div className="mt-0.5 text-xs text-muted-2">
            {t.regionName} {t.dong ?? ''}
            {t.areaM2 != null && ` · ${t.areaM2}㎡`}
            {t.floor != null && ` · ${t.floor}층`}
            {contract && ` · 계약 ${contract}`}
          </div>
        </div>
        {price && <span className="shrink-0 font-mono text-[14px] font-bold">{price}</span>}
        <span className="shrink-0 text-muted-2">›</span>
      </button>
    </li>
  )
}

function complexNormOf(name: string): string {
  return name.replace(/[\s()0-9차]/g, '')
}

function TxDetailSheet({ t, onClose }: { t: RecentTransaction; onClose: () => void }) {
  const navigate = useNavigate()
  const c = t.tradeType === 'SALE' ? '#3df5c5' : '#5ba8ff'
  const norm = t.complexName ? complexNormOf(t.complexName) : ''
  const rows: { k: string; v: string }[] = []
  if (t.tradeType === 'MONTHLY') {
    if (t.priceText) rows.push({ k: '보증금', v: t.priceText })
    if (t.monthlyRentManwon != null) rows.push({ k: '월세', v: `${t.monthlyRentManwon.toLocaleString()}만` })
  }
  if (t.contractDate) rows.push({ k: '계약일', v: t.contractDate })
  if (t.registeredAt) rows.push({ k: '신고/등록일', v: t.registeredAt })
  if (t.buildYear != null) rows.push({ k: '건축년도', v: `${t.buildYear}년` })
  if (t.areaM2 != null) rows.push({ k: '전용면적', v: `${t.areaM2}㎡ (약 ${(t.areaM2 / PYEONG_TO_M2).toFixed(1)}평)` })
  if (t.floor != null) rows.push({ k: '층', v: `${t.floor}층` })
  if (t.buildingDong) rows.push({ k: '동', v: t.buildingDong })
  if (t.dealingType) rows.push({ k: '거래유형', v: t.dealingType })
  if (t.jibun) rows.push({ k: '지번', v: `${t.dong ?? ''} ${t.jibun}`.trim() })
  if (t.landAreaM2 != null) rows.push({ k: '대지권면적', v: `${t.landAreaM2}㎡` })
  rows.push({ k: '출처', v: t.sourceName })

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60" onClick={onClose}>
      <div
        className="w-full max-w-[430px] overflow-x-hidden rounded-t-[22px] border-t border-white/10 bg-bg px-5 pb-8 pt-3"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-white/15" />
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="shrink-0 rounded-lg px-2 py-1 text-[11px] font-bold" style={{ color: c, background: `${c}22` }}>
                {TRADE_TYPE_LABELS[t.tradeType] ?? t.tradeType}
              </span>
              <h2 className="truncate text-[17px] font-extrabold">{t.complexName ?? '(단지 미상)'}</h2>
            </div>
            <p className="mt-1 text-xs text-muted-2">{t.regionName} {t.dong ?? ''}</p>
          </div>
          {priceLabel(t) && <span className="shrink-0 font-mono text-[17px] font-extrabold">{priceLabel(t)}</span>}
        </div>
        <dl className="mt-4 divide-y divide-white/[0.06]">
          {rows.map((r) => (
            <div key={r.k} className="flex justify-between gap-4 py-2.5">
              <dt className="text-sm text-muted-2">{r.k}</dt>
              <dd className="text-right text-sm font-semibold">{r.v}</dd>
            </div>
          ))}
        </dl>
        {norm && (
          <button
            type="button"
            onClick={() => navigate(`/complex?gu=${encodeURIComponent(t.regionName)}&norm=${encodeURIComponent(norm)}&name=${encodeURIComponent(t.complexName ?? '')}`)}
            className="mt-5 w-full rounded-[14px] bg-mint py-3.5 text-sm font-bold text-mint-ink"
          >
            이 단지 시세 추이 보기 →
          </button>
        )}
        <button type="button" onClick={onClose} className="mt-2.5 w-full rounded-[14px] bg-surface py-3.5 text-sm font-bold">
          닫기
        </button>
      </div>
    </div>
  )
}

function FilterSheet({ initial, guOptions, onApply, onClose }: {
  initial: TxFilters
  guOptions: string[]
  onApply: (f: TxFilters) => void
  onClose: () => void
}) {
  const [d, setD] = useState<TxFilters>(initial)
  const set = (patch: Partial<TxFilters>) => setD((prev) => ({ ...prev, ...patch }))
  const regions = useRegions(d.gu || null)

  const priceFull = d.eokMin <= 0 && d.eokMax >= 50
  const priceReadout = priceFull ? '전체 금액' : `${d.eokMin > 0 ? fmtEok(d.eokMin) : ''}~${d.eokMax < 50 ? fmtEok(d.eokMax) : ''}억`

  const conv = (v: number) => d.areaUnit === 'sqm' ? `${Math.round(v * PYEONG_TO_M2)}㎡` : `${v}평`
  const areaFull = d.pyeongMin <= 0 && d.pyeongMax >= 60
  const areaReadout = areaFull ? '전체 면적' : `${d.pyeongMin > 0 ? conv(d.pyeongMin) : ''}~${d.pyeongMax < 60 ? conv(d.pyeongMax) : ''}`

  const builtDirect = !!(d.yearMin || d.yearMax)

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60" onClick={onClose}>
      <div
        className="max-h-[90vh] w-full max-w-[430px] overflow-x-hidden overflow-y-auto rounded-t-[22px] border-t border-white/10 bg-bg px-5 pb-8 pt-3 [scrollbar-width:none]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-white/15" />
        <div className="flex items-center justify-between">
          <h2 className="text-[17px] font-extrabold">필터</h2>
          <button type="button" onClick={() => setD(EMPTY)} className="text-xs font-semibold text-muted-2 underline">
            전체 초기화
          </button>
        </div>

        <div className="mt-5 space-y-6">
          {/* 거래유형 */}
          <FilterSection label="거래유형">
            <div className="flex flex-wrap gap-2">
              {FILTER_TYPES.map(({ label, value }) => (
                <Chip key={value} selected={d.tradeType === value} onClick={() => set({ tradeType: value })}>
                  {label}
                </Chip>
              ))}
            </div>
          </FilterSection>

          {/* 거래금액 */}
          <FilterSection label="거래금액" readout={priceReadout}>
            <DualSlider
              min={0} max={50} step={0.5}
              lo={d.eokMin} hi={d.eokMax}
              onLo={(v) => set({ eokMin: v })}
              onHi={(v) => set({ eokMax: v })}
            />
            <div className="mt-2 flex items-center gap-2">
              <PriceInput
                label="최소"
                value={d.eokMin === 0 ? '' : fmtEok(d.eokMin)}
                placeholder="0"
                onChange={(raw) => {
                  const v = parseFloat(raw)
                  if (!raw) set({ eokMin: 0 })
                  else if (!Number.isNaN(v)) set({ eokMin: Math.max(0, Math.min(v, d.eokMax - 0.5)) })
                }}
                suffix="억"
              />
              <span className="text-muted-2">~</span>
              <PriceInput
                label="최대"
                value={d.eokMax >= 50 ? '' : fmtEok(d.eokMax)}
                placeholder="50"
                onChange={(raw) => {
                  const v = parseFloat(raw)
                  if (!raw) set({ eokMax: 50 })
                  else if (!Number.isNaN(v)) set({ eokMax: Math.min(50, Math.max(v, d.eokMin + 0.5)) })
                }}
                suffix="억"
              />
            </div>
            <p className="mt-1.5 text-[11px] text-muted-2">전세·월세는 보증금 기준</p>
          </FilterSection>

          {/* 면적 */}
          <FilterSection
            label="면적 (전용)"
            readout={areaReadout}
            right={
              <div className="flex rounded-[8px] bg-surface-2 p-0.5">
                {(['pyeong', 'sqm'] as const).map((u) => (
                  <button
                    key={u}
                    type="button"
                    onClick={() => set({ areaUnit: u })}
                    className={`rounded-[6px] px-3 py-1 text-[12px] font-bold transition-colors ${d.areaUnit === u ? 'bg-mint text-mint-ink' : 'text-muted-2'}`}
                  >
                    {u === 'pyeong' ? '평' : '㎡'}
                  </button>
                ))}
              </div>
            }
          >
            <DualSlider
              min={0} max={60} step={1}
              lo={d.pyeongMin} hi={d.pyeongMax}
              onLo={(v) => set({ pyeongMin: v })}
              onHi={(v) => set({ pyeongMax: v })}
            />
            <div className="mt-2 flex flex-wrap gap-1.5">
              {AREA_QUICK.map(({ label, lo, hi }) => (
                <Chip
                  key={label}
                  selected={d.pyeongMin === lo && d.pyeongMax === hi}
                  onClick={() => set({ pyeongMin: lo, pyeongMax: hi })}
                >
                  {label}
                </Chip>
              ))}
            </div>
          </FilterSection>

          {/* 층수 */}
          <FilterSection label="층수">
            <div className="flex gap-2">
              {(['저층', '중층', '고층'] as const).map((b) => (
                <Chip
                  key={b}
                  selected={d.floorBands.includes(b)}
                  onClick={() =>
                    set({
                      floorBands: d.floorBands.includes(b)
                        ? d.floorBands.filter((x) => x !== b)
                        : [...d.floorBands, b],
                    })
                  }
                >
                  {b}
                </Chip>
              ))}
            </div>
          </FilterSection>

          {/* 연식 */}
          <FilterSection label="연식">
            <div className="flex flex-wrap gap-2">
              {BUILT_PRESETS.map(({ label, v }) => (
                <Chip
                  key={label}
                  selected={!builtDirect && d.builtPreset === v}
                  onClick={() => set({ builtPreset: v, yearMin: '', yearMax: '' })}
                >
                  {label}
                </Chip>
              ))}
            </div>
            <div className="mt-2 flex items-center gap-1.5">
              <YearInput
                value={d.yearMin}
                placeholder="시작년도"
                onChange={(v) => set({ yearMin: v, builtPreset: null })}
              />
              <span className="shrink-0 text-xs text-muted-2">~</span>
              <YearInput
                value={d.yearMax}
                placeholder="종료년도"
                onChange={(v) => set({ yearMax: v, builtPreset: null })}
              />
            </div>
            <p className="mt-1.5 text-[11px] text-muted-2">준공년도 직접 입력 (예: 2005 ~ 2020)</p>
          </FilterSection>

          {/* 지역 */}
          <FilterSection label="지역">
            <div className="flex gap-2">
              <GSelect
                value={d.gu}
                onChange={(v) => set({ gu: v, dong: '' })}
                placeholder="전체 자치구"
              >
                {guOptions.map((g) => <option key={g} value={g}>{g}</option>)}
              </GSelect>
              <GSelect
                value={d.dong}
                onChange={(v) => set({ dong: v })}
                placeholder={d.gu ? '전체 동' : '구 먼저 선택'}
                disabled={!d.gu || regions.isLoading}
              >
                {regions.data?.map((r) => <option key={r.bjdCode} value={r.dongName}>{r.dongName}</option>)}
              </GSelect>
            </div>
          </FilterSection>

          {/* 거래일 */}
          <FilterSection label="거래일">
            <div className="flex items-center gap-2">
              <DateInput value={d.dateFrom} onChange={(v) => set({ dateFrom: v })} />
              <span className="text-muted-2">~</span>
              <DateInput value={d.dateTo} onChange={(v) => set({ dateTo: v })} />
            </div>
          </FilterSection>
        </div>

        <button
          type="button"
          onClick={() => onApply(d)}
          className="mt-6 w-full rounded-[14px] bg-mint py-3.5 text-sm font-bold text-mint-ink"
        >
          적용
        </button>
        <button type="button" onClick={onClose} className="mt-2.5 w-full rounded-[14px] bg-surface py-3.5 text-sm font-bold">
          닫기
        </button>
      </div>
    </div>
  )
}

function FilterSection({ label, readout, right, children }: {
  label: string; readout?: string; right?: ReactNode; children: ReactNode
}) {
  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-baseline gap-2">
          <p className="text-xs font-bold text-muted-2">{label}</p>
          {readout && <span className="font-mono text-[13px] font-bold text-mint">{readout}</span>}
        </div>
        {right}
      </div>
      {children}
    </div>
  )
}

function PriceInput({ label, value, placeholder, onChange, suffix }: {
  label: string; value: string; placeholder: string; onChange: (v: string) => void; suffix: string
}) {
  return (
    <div className="flex min-w-0 flex-1 items-center gap-1.5 rounded-[11px] border border-white/10 bg-surface px-3 py-2.5">
      <span className="shrink-0 text-xs text-muted-2">{label}</span>
      <input
        type="number"
        inputMode="decimal"
        step="0.5"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="min-w-0 flex-1 bg-transparent text-right font-mono text-sm font-bold outline-none placeholder:font-normal placeholder:text-muted-2"
      />
      <span className="shrink-0 text-xs text-muted-2">{suffix}</span>
    </div>
  )
}

function YearInput({ value, placeholder, onChange }: {
  value: string; placeholder: string; onChange: (v: string) => void
}) {
  return (
    <input
      type="text"
      inputMode="numeric"
      maxLength={4}
      value={value}
      onChange={(e) => onChange(e.target.value.replace(/[^0-9]/g, '').slice(0, 4))}
      placeholder={placeholder}
      className="min-w-0 flex-1 rounded-[11px] border border-white/10 bg-surface px-2 py-2.5 text-center font-mono text-sm font-bold outline-none placeholder:text-[11px] placeholder:font-normal placeholder:text-muted-2"
    />
  )
}

function DateInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <input
      type="date"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="min-w-0 flex-1 rounded-[12px] border border-white/[0.08] bg-surface px-3 py-2.5 text-sm font-bold [color-scheme:dark]"
    />
  )
}

function GSelect({ value, onChange, placeholder, disabled, children }: {
  value: string; onChange: (v: string) => void
  placeholder: string; disabled?: boolean; children: ReactNode
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      className="flex-1 rounded-[12px] border border-white/[0.08] bg-surface px-3 py-2.5 text-sm font-bold disabled:opacity-40"
    >
      <option value="">{placeholder}</option>
      {children}
    </select>
  )
}

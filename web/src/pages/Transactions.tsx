import { useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import Chip from '../components/Chip'
import { SEOUL_GU, TRADE_TYPE_LABELS } from '../lib/constants'
import {
  usePreferences,
  useRecentTransactions,
  useRegions,
  type RecentTransactionParams,
} from '../lib/hooks'
import type { RecentTransaction } from '../lib/types'

const TRADE_TYPE_FILTERS = ['SALE', 'JEONSE', 'MONTHLY', 'PRESALE'] as const
const PYEONG_TO_M2 = 3.3058 // 1평 ≈ 3.3058㎡

interface TxFilters {
  gu: string
  dong: string
  tradeType: string
  pyeongMin: string
  pyeongMax: string
  eokMin: string
  eokMax: string
  floorMin: string
  floorMax: string
  yearMin: string
  yearMax: string
  dateFrom: string
  dateTo: string
}

const EMPTY_FILTERS: TxFilters = {
  gu: '',
  dong: '',
  tradeType: '',
  pyeongMin: '',
  pyeongMax: '',
  eokMin: '',
  eokMax: '',
  floorMin: '',
  floorMax: '',
  yearMin: '',
  yearMax: '',
  dateFrom: '',
  dateTo: '',
}

const num = (s: string): number | undefined => {
  const v = Number(s)
  return s.trim() !== '' && !Number.isNaN(v) ? v : undefined
}

function toParams(f: TxFilters): RecentTransactionParams {
  const pyMin = num(f.pyeongMin)
  const pyMax = num(f.pyeongMax)
  const eokMin = num(f.eokMin)
  const eokMax = num(f.eokMax)
  return {
    region: f.gu || undefined,
    dong: f.gu ? f.dong || undefined : undefined,
    tradeType: f.tradeType || undefined,
    areaMin: pyMin != null ? +(pyMin * PYEONG_TO_M2).toFixed(2) : undefined,
    areaMax: pyMax != null ? +(pyMax * PYEONG_TO_M2).toFixed(2) : undefined,
    priceMin: eokMin != null ? Math.round(eokMin * 10000) : undefined,
    priceMax: eokMax != null ? Math.round(eokMax * 10000) : undefined,
    floorMin: num(f.floorMin),
    floorMax: num(f.floorMax),
    buildYearMin: num(f.yearMin),
    buildYearMax: num(f.yearMax),
    contractFrom: f.dateFrom || undefined,
    contractTo: f.dateTo || undefined,
  }
}

function rangeText(min: string, max: string, unit: string): string | null {
  if (!min && !max) return null
  if (min && max) return `${min}~${max}${unit}`
  if (min) return `${min}${unit}+`
  return `~${max}${unit}`
}

function summaryChips(f: TxFilters): string[] {
  const out: string[] = []
  if (f.gu) out.push(`${f.gu}${f.dong ? ` ${f.dong}` : ''}`)
  if (f.tradeType) out.push(TRADE_TYPE_LABELS[f.tradeType] ?? f.tradeType)
  const py = rangeText(f.pyeongMin, f.pyeongMax, '평')
  if (py) out.push(py)
  const eok = rangeText(f.eokMin, f.eokMax, '억')
  if (eok) out.push(eok)
  const fl = rangeText(f.floorMin, f.floorMax, '층')
  if (fl) out.push(fl)
  const yr = rangeText(f.yearMin, f.yearMax, '년')
  if (yr) out.push(yr)
  if (f.dateFrom || f.dateTo) out.push(`계약 ${f.dateFrom || '…'}~${f.dateTo || '…'}`)
  return out
}

export default function Transactions() {
  const prefs = usePreferences()
  const watchGus = prefs.data?.watchRegions.map((r) => r.guName) ?? []
  const [filters, setFilters] = useState<TxFilters>(EMPTY_FILTERS)
  const [filterOpen, setFilterOpen] = useState(false)
  const [selected, setSelected] = useState<RecentTransaction | null>(null)

  const tx = useRecentTransactions(toParams(filters))
  const guOptions = watchGus.length > 0 ? watchGus : [...SEOUL_GU]
  const chips = summaryChips(filters)

  return (
    <div className="space-y-5">
      <h1 className="mt-1.5 text-[21px] font-extrabold tracking-tight">실거래 신규 등록</h1>

      <button
        type="button"
        onClick={() => setFilterOpen(true)}
        className="flex w-full items-center justify-between rounded-[14px] border border-white/[0.08] bg-surface px-4 py-3 text-left"
      >
        <span className="flex items-center gap-2 text-sm font-bold">
          <span>⚙︎ 필터</span>
          {chips.length > 0 && (
            <span className="rounded-full bg-mint/20 px-2 py-0.5 text-[11px] font-bold text-mint">
              {chips.length}
            </span>
          )}
        </span>
        <span className="text-muted-2">›</span>
      </button>

      {chips.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {chips.map((c) => (
            <span
              key={c}
              className="rounded-full border border-white/10 bg-surface px-2.5 py-1 text-xs font-semibold text-muted"
            >
              {c}
            </span>
          ))}
          <button
            type="button"
            onClick={() => setFilters(EMPTY_FILTERS)}
            className="rounded-full px-2 py-1 text-xs font-semibold text-muted-2 underline"
          >
            초기화
          </button>
        </div>
      )}

      {tx.isLoading && <p className="text-sm text-muted-2">불러오는 중…</p>}
      {tx.data && tx.data.items.length === 0 && (
        <p className="text-sm text-muted-2">조건에 맞는 실거래가 없습니다.</p>
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
          onApply={(next) => {
            setFilters(next)
            setFilterOpen(false)
          }}
          onClose={() => setFilterOpen(false)}
        />
      )}
    </div>
  )
}

// 계약일 ISO(2026-06-27) → "06.27"
function fmtContract(d: string | null): string | null {
  if (!d) return null
  const [, m, day] = d.split('-')
  return m && day ? `${m}.${day}` : d
}

// 월세는 '보증금 / 월세'로 표기. priceText는 보증금(억·만 환산).
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

// complex_norm: V10 인덱스/안전마진과 동일 규칙(공백·괄호·숫자·'차' 제거).
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
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-t-[22px] border-t border-white/10 bg-bg px-5 pb-8 pt-3"
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
            onClick={() =>
              navigate(
                `/complex?gu=${encodeURIComponent(t.regionName)}&norm=${encodeURIComponent(norm)}&name=${encodeURIComponent(t.complexName ?? '')}`,
              )
            }
            className="mt-5 w-full rounded-[14px] bg-mint py-3.5 text-sm font-bold text-mint-ink"
          >
            이 단지 시세 추이 보기 →
          </button>
        )}

        <button
          type="button"
          onClick={onClose}
          className="mt-2.5 w-full rounded-[14px] bg-surface py-3.5 text-sm font-bold"
        >
          닫기
        </button>
      </div>
    </div>
  )
}

function FilterSheet({
  initial,
  guOptions,
  onApply,
  onClose,
}: {
  initial: TxFilters
  guOptions: string[]
  onApply: (f: TxFilters) => void
  onClose: () => void
}) {
  const [d, setD] = useState<TxFilters>(initial)
  const regions = useRegions(d.gu || null)
  const set = (patch: Partial<TxFilters>) => setD((prev) => ({ ...prev, ...patch }))

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60" onClick={onClose}>
      <div
        className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-t-[22px] border-t border-white/10 bg-bg px-5 pb-8 pt-3"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-white/15" />
        <div className="flex items-center justify-between">
          <h2 className="text-[17px] font-extrabold">필터</h2>
          <button
            type="button"
            onClick={() => setD(EMPTY_FILTERS)}
            className="text-xs font-semibold text-muted-2 underline"
          >
            전체 초기화
          </button>
        </div>

        <div className="mt-5 space-y-5">
          <Section label="지역">
            <div className="flex gap-2.5">
              <Select
                value={d.gu}
                onChange={(v) => set({ gu: v, dong: '' })}
                placeholder="전체 자치구"
              >
                {guOptions.map((g) => (
                  <option key={g} value={g}>
                    {g}
                  </option>
                ))}
              </Select>
              <Select
                value={d.dong}
                onChange={(v) => set({ dong: v })}
                placeholder={d.gu ? '전체 동' : '구 먼저 선택'}
                disabled={!d.gu || regions.isLoading}
              >
                {regions.data?.map((r) => (
                  <option key={r.bjdCode} value={r.dongName}>
                    {r.dongName}
                  </option>
                ))}
              </Select>
            </div>
          </Section>

          <Section label="유형">
            <div className="flex flex-wrap gap-2">
              <Chip selected={d.tradeType === ''} onClick={() => set({ tradeType: '' })}>
                전체
              </Chip>
              {TRADE_TYPE_FILTERS.map((tt) => (
                <Chip key={tt} selected={d.tradeType === tt} onClick={() => set({ tradeType: tt })}>
                  {TRADE_TYPE_LABELS[tt]}
                </Chip>
              ))}
            </div>
          </Section>

          <Section label="평수 (전용)">
            <Range
              unit="평"
              min={d.pyeongMin}
              max={d.pyeongMax}
              onMin={(v) => set({ pyeongMin: v })}
              onMax={(v) => set({ pyeongMax: v })}
            />
          </Section>

          <Section label="가격대">
            <Range
              unit="억"
              step="0.1"
              min={d.eokMin}
              max={d.eokMax}
              onMin={(v) => set({ eokMin: v })}
              onMax={(v) => set({ eokMax: v })}
            />
          </Section>

          <Section label="층수">
            <Range
              unit="층"
              min={d.floorMin}
              max={d.floorMax}
              onMin={(v) => set({ floorMin: v })}
              onMax={(v) => set({ floorMax: v })}
            />
          </Section>

          <Section label="건축년도 (연식)">
            <Range
              unit="년"
              min={d.yearMin}
              max={d.yearMax}
              onMin={(v) => set({ yearMin: v })}
              onMax={(v) => set({ yearMax: v })}
            />
          </Section>

          <Section label="거래일">
            <div className="flex items-center gap-2">
              <DateInput value={d.dateFrom} onChange={(v) => set({ dateFrom: v })} />
              <span className="text-muted-2">~</span>
              <DateInput value={d.dateTo} onChange={(v) => set({ dateTo: v })} />
            </div>
          </Section>
        </div>

        <button
          type="button"
          onClick={() => onApply(d)}
          className="mt-6 w-full rounded-[14px] bg-mint py-3.5 text-sm font-bold text-mint-ink"
        >
          적용
        </button>
        <button
          type="button"
          onClick={onClose}
          className="mt-2.5 w-full rounded-[14px] bg-surface py-3.5 text-sm font-bold"
        >
          닫기
        </button>
      </div>
    </div>
  )
}

function Section({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <p className="mb-2 text-xs font-bold text-muted-2">{label}</p>
      {children}
    </div>
  )
}

function Range({
  unit,
  step,
  min,
  max,
  onMin,
  onMax,
}: {
  unit: string
  step?: string
  min: string
  max: string
  onMin: (v: string) => void
  onMax: (v: string) => void
}) {
  return (
    <div className="flex items-center gap-2">
      <NumInput value={min} onChange={onMin} placeholder="최소" step={step} />
      <span className="shrink-0 text-xs text-muted-2">{unit}</span>
      <span className="text-muted-2">~</span>
      <NumInput value={max} onChange={onMax} placeholder="최대" step={step} />
      <span className="shrink-0 text-xs text-muted-2">{unit}</span>
    </div>
  )
}

function NumInput({
  value,
  onChange,
  placeholder,
  step,
}: {
  value: string
  onChange: (v: string) => void
  placeholder: string
  step?: string
}) {
  return (
    <input
      type="number"
      inputMode="decimal"
      step={step}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full min-w-0 rounded-[12px] border border-white/[0.08] bg-surface px-3 py-2.5 text-sm font-bold placeholder:text-muted-2 placeholder:font-normal"
    />
  )
}

function DateInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <input
      type="date"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full min-w-0 rounded-[12px] border border-white/[0.08] bg-surface px-3 py-2.5 text-sm font-bold"
    />
  )
}

function Select({
  value,
  onChange,
  placeholder,
  disabled,
  children,
}: {
  value: string
  onChange: (v: string) => void
  placeholder: string
  disabled?: boolean
  children: ReactNode
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

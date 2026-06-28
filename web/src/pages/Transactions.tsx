import { useState, type ReactNode } from 'react'
import Chip from '../components/Chip'
import { SEOUL_GU, TRADE_TYPE_LABELS } from '../lib/constants'
import { usePreferences, useRecentTransactions, useRegions } from '../lib/hooks'
import type { RecentTransaction } from '../lib/types'

const TRADE_TYPE_FILTERS = ['SALE', 'JEONSE', 'MONTHLY', 'PRESALE'] as const

// 전용면적(㎡) 기준 평형대. 1평 ≈ 3.3058㎡ (20평≈66·30평≈99·40평≈132㎡)
const AREA_FILTERS: { label: string; min?: number; max?: number }[] = [
  { label: '전체' },
  { label: '~20평', max: 66 },
  { label: '20평대', min: 66, max: 99 },
  { label: '30평대', min: 99, max: 132 },
  { label: '40평대+', min: 132 },
]

export default function Transactions() {
  const prefs = usePreferences()
  const watchGus = prefs.data?.watchRegions.map((r) => r.guName) ?? []
  const [gu, setGu] = useState<string>('')
  const [dong, setDong] = useState<string>('')
  const [tradeType, setTradeType] = useState<string>('')
  const [areaIdx, setAreaIdx] = useState<number>(0)
  const [selected, setSelected] = useState<RecentTransaction | null>(null)

  const regions = useRegions(gu || null)
  const area = AREA_FILTERS[areaIdx]
  const tx = useRecentTransactions({
    region: gu || undefined,
    dong: gu ? dong || undefined : undefined,
    tradeType: tradeType || undefined,
    areaMin: area.min,
    areaMax: area.max,
  })

  const onGuChange = (next: string) => {
    setGu(next)
    setDong('')
  }

  const guOptions = watchGus.length > 0 ? watchGus : [...SEOUL_GU]

  return (
    <div className="space-y-5">
      <h1 className="mt-1.5 text-[21px] font-extrabold tracking-tight">실거래 신규 등록</h1>

      <div className="flex flex-wrap gap-2">
        <Chip selected={tradeType === ''} onClick={() => setTradeType('')}>
          전체
        </Chip>
        {TRADE_TYPE_FILTERS.map((tt) => (
          <Chip key={tt} selected={tradeType === tt} onClick={() => setTradeType(tt)}>
            {TRADE_TYPE_LABELS[tt]}
          </Chip>
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        {AREA_FILTERS.map((a, i) => (
          <Chip key={a.label} selected={areaIdx === i} onClick={() => setAreaIdx(i)}>
            {a.label}
          </Chip>
        ))}
      </div>

      <div className="flex gap-2.5">
        <Select value={gu} onChange={onGuChange} placeholder="전체 자치구">
          {guOptions.map((g) => (
            <option key={g} value={g}>
              {g}
            </option>
          ))}
        </Select>
        <Select
          value={dong}
          onChange={setDong}
          placeholder={gu ? '전체 동' : '구 먼저 선택'}
          disabled={!gu || regions.isLoading}
        >
          {regions.data?.map((r) => (
            <option key={r.bjdCode} value={r.dongName}>
              {r.dongName}
            </option>
          ))}
        </Select>
      </div>

      {tx.isLoading && <p className="text-sm text-muted-2">불러오는 중…</p>}
      {tx.data && tx.data.items.length === 0 && (
        <p className="text-sm text-muted-2">최근 등록된 실거래가 없습니다.</p>
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
    </div>
  )
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
          </div>
        </div>
        {price && <span className="shrink-0 font-mono text-[14px] font-bold">{price}</span>}
        <span className="shrink-0 text-muted-2">›</span>
      </button>
    </li>
  )
}

function TxDetailSheet({ t, onClose }: { t: RecentTransaction; onClose: () => void }) {
  const c = t.tradeType === 'SALE' ? '#3df5c5' : '#5ba8ff'
  const rows: { k: string; v: string }[] = []
  if (t.tradeType === 'MONTHLY') {
    if (t.priceText) rows.push({ k: '보증금', v: t.priceText })
    if (t.monthlyRentManwon != null) rows.push({ k: '월세', v: `${t.monthlyRentManwon.toLocaleString()}만` })
  }
  if (t.contractDate) rows.push({ k: '계약일', v: t.contractDate })
  if (t.registeredAt) rows.push({ k: '신고/등록일', v: t.registeredAt })
  if (t.buildYear != null) rows.push({ k: '건축년도', v: `${t.buildYear}년` })
  if (t.areaM2 != null) rows.push({ k: '전용면적', v: `${t.areaM2}㎡ (약 ${(t.areaM2 / 3.3058).toFixed(1)}평)` })
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

        <button
          type="button"
          onClick={onClose}
          className="mt-5 w-full rounded-[14px] bg-surface py-3.5 text-sm font-bold"
        >
          닫기
        </button>
      </div>
    </div>
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

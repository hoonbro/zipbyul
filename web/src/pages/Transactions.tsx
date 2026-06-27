import { useState, type ReactNode } from 'react'
import { SEOUL_GU, TRADE_TYPE_LABELS } from '../lib/constants'
import { usePreferences, useRecentTransactions, useRegions } from '../lib/hooks'
import type { RecentTransaction } from '../lib/types'

export default function Transactions() {
  const prefs = usePreferences()
  const watchGus = prefs.data?.watchRegions.map((r) => r.guName) ?? []
  const [gu, setGu] = useState<string>('')
  const [dong, setDong] = useState<string>('')

  const regions = useRegions(gu || null)
  const tx = useRecentTransactions(gu ? { region: gu, dong: dong || undefined } : {})

  const onGuChange = (next: string) => {
    setGu(next)
    setDong('')
  }

  const guOptions = watchGus.length > 0 ? watchGus : [...SEOUL_GU]

  return (
    <div className="space-y-5">
      <h1 className="mt-1.5 text-[21px] font-extrabold tracking-tight">실거래 신규 등록</h1>

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
          <TxRow key={t.transactionId} t={t} />
        ))}
      </ul>

      {tx.data?.notice && (
        <div className="flex gap-1.5 px-0.5">
          <span className="text-xs text-muted-2">ⓘ</span>
          <span className="text-xs leading-snug text-muted-2">{tx.data.notice}</span>
        </div>
      )}
    </div>
  )
}

function TxRow({ t }: { t: RecentTransaction }) {
  const c = t.tradeType === 'SALE' ? '#3df5c5' : '#5ba8ff'
  return (
    <li className="flex items-center gap-3 rounded-[15px] border border-white/[0.06] bg-surface px-4 py-3">
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
      {t.priceText && <span className="shrink-0 font-mono text-[15px] font-bold">{t.priceText}</span>}
    </li>
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

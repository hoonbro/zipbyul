import { useState } from 'react'
import Chip from '../components/Chip'
import { SEOUL_GU } from '../lib/constants'
import { usePreferences, useSavePreferences, useWatchSummary } from '../lib/hooks'
import type { Preferences } from '../lib/types'

export default function WatchRegions() {
  const summary = useWatchSummary()
  const prefs = usePreferences()

  return (
    <div className="space-y-6">
      <h1 className="mt-1.5 text-[21px] font-extrabold tracking-tight">관심지역</h1>

      <section>
        <h2 className="mb-3 text-base font-extrabold tracking-tight">요약</h2>
        {summary.isLoading && <p className="text-sm text-muted-2">불러오는 중…</p>}
        {summary.data && summary.data.length === 0 && (
          <p className="text-sm text-muted-2">선택한 관심지역이 없습니다.</p>
        )}
        <ul className="space-y-2.5">
          {summary.data?.map((r) => (
            <li key={r.regionName} className="flex items-center justify-between rounded-[15px] border border-white/[0.06] bg-surface px-4 py-3.5">
              <div className="flex items-center gap-2.5">
                <span className="h-[7px] w-[7px] rounded-full bg-mint" style={{ boxShadow: '0 0 7px #3df5c5' }} />
                <span className="text-[15px] font-bold">{r.regionName}</span>
              </div>
              <div className="flex gap-3.5">
                <Stat v={r.announcementCount} k="공고" color="#5ba8ff" />
                <Stat v={r.deadlineCount} k="마감임박" color="#ffce5a" />
                <Stat v={r.recentTransactionCount} k="실거래" color="#3df5c5" />
              </div>
            </li>
          ))}
        </ul>
      </section>

      {prefs.data ? (
        <RegionEditor prefs={prefs.data} />
      ) : (
        <p className="text-sm text-muted-2">설정 불러오는 중…</p>
      )}
    </div>
  )
}

function Stat({ v, k, color }: { v: number; k: string; color: string }) {
  return (
    <div className="text-center">
      <div className="font-mono text-[15px] font-bold" style={{ color }}>
        {v}
      </div>
      <div className="mt-px text-[10px] text-muted-2">{k}</div>
    </div>
  )
}

function RegionEditor({ prefs }: { prefs: Preferences }) {
  const save = useSavePreferences()
  const [selected, setSelected] = useState<string[]>(() => prefs.watchRegions.map((r) => r.guName))

  const toggle = (gu: string) =>
    setSelected((s) => (s.includes(gu) ? s.filter((v) => v !== gu) : [...s, gu]))

  const submit = () =>
    save.mutate({
      alertLevel: prefs.alertLevel,
      interestTypes: prefs.interestTypes,
      watchRegions: selected.map((guName) => ({ guName })),
      txAlertOptin: prefs.txAlertOptin,
      dailyDigestEnabled: prefs.dailyDigestEnabled,
      dailyDigestTime: prefs.dailyDigestTime,
      dndStart: prefs.dndStart,
      dndEnd: prefs.dndEnd,
    })

  return (
    <section>
      <h2 className="mb-3 text-base font-extrabold tracking-tight">지역 편집 (자치구)</h2>
      <div className="flex flex-wrap gap-2.5">
        {SEOUL_GU.map((gu) => (
          <Chip key={gu} selected={selected.includes(gu)} onClick={() => toggle(gu)}>
            {gu}
          </Chip>
        ))}
      </div>
      <button
        type="button"
        onClick={submit}
        disabled={save.isPending}
        className="mt-5 w-full rounded-[14px] bg-mint py-3.5 text-sm font-bold text-mint-ink disabled:opacity-40"
      >
        {save.isPending ? '저장 중…' : '저장'}
      </button>
      {save.isSuccess && <p className="mt-2 text-center text-xs text-mint">저장됐습니다.</p>}
      {save.isError && <p className="mt-2 text-center text-xs text-coral">저장 실패</p>}
    </section>
  )
}

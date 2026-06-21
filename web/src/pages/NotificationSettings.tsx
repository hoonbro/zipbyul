import { useState } from 'react'
import Chip from '../components/Chip'
import PushSetup from '../components/PushSetup'
import { ALERT_LEVELS, INTEREST_TYPES } from '../lib/constants'
import {
  useDeleteMyData,
  useNotifications,
  usePreferences,
  useSavePreferences,
} from '../lib/hooks'
import { clearAnonymousId } from '../lib/anonymousUser'
import type { Preferences } from '../lib/types'

const CHANNEL_LABEL: Record<string, string> = { PUSH: '푸시', IN_APP: '앱내', DIGEST: '요약' }
const STATUS_LABEL: Record<string, string> = {
  SENT: '발송', FAILED: '실패', SKIPPED: '건너뜀', DEDUPED: '중복',
}

const hhmm = (t: string | null) => (t ? t.slice(0, 5) : '')
const orNull = (s: string) => (s ? s : null)

const timeInput = 'rounded-lg border border-white/10 bg-surface-2 px-2 py-1 text-ink [color-scheme:dark]'

export default function NotificationSettings() {
  const prefs = usePreferences()
  const logs = useNotifications()

  return (
    <div className="space-y-6">
      <h1 className="mt-1.5 text-[21px] font-extrabold tracking-tight">알림 설정</h1>

      <PushSetup />

      {prefs.data ? (
        <SettingsForm prefs={prefs.data} />
      ) : (
        <p className="text-sm text-muted-2">설정 불러오는 중…</p>
      )}

      <section>
        <h2 className="mb-3 text-base font-extrabold tracking-tight">알림함</h2>
        {logs.isLoading && <p className="text-sm text-muted-2">불러오는 중…</p>}
        {logs.data && logs.data.length === 0 && <p className="text-sm text-muted-2">받은 알림이 없습니다.</p>}
        <ul className="space-y-2">
          {logs.data?.map((n) => (
            <li key={n.id} className="flex justify-between rounded-[12px] border border-white/[0.06] bg-surface px-3.5 py-2.5 text-xs">
              <span className="text-muted">
                {CHANNEL_LABEL[n.channel] ?? n.channel} · {STATUS_LABEL[n.status] ?? n.status}
                {n.finalScore != null && (
                  <span className="text-amber"> · {'★'.repeat(Math.max(1, Math.min(5, Math.ceil(n.finalScore / 2))))}</span>
                )}
              </span>
              <span className="font-mono text-muted-2">{n.sentAt.slice(0, 16).replace('T', ' ')}</span>
            </li>
          ))}
        </ul>
      </section>

      <DangerZone />
    </div>
  )
}

function DangerZone() {
  const del = useDeleteMyData()

  const remove = () => {
    if (!window.confirm('관심설정·기기·알림 이력이 모두 삭제됩니다. 계속할까요?')) return
    del.mutate(undefined, {
      onSuccess: () => {
        clearAnonymousId()
        localStorage.removeItem('jb_device_id')
        window.location.href = '/'
      },
    })
  }

  return (
    <section className="border-t border-white/[0.06] pt-5">
      <button
        type="button"
        onClick={remove}
        disabled={del.isPending}
        className="text-sm text-coral underline disabled:opacity-50"
      >
        {del.isPending ? '삭제 중…' : '내 데이터 삭제'}
      </button>
      <p className="mt-1.5 text-[11px] text-muted-2">localStorage 식별자가 삭제되며 복구할 수 없습니다.</p>
    </section>
  )
}

function SettingsForm({ prefs }: { prefs: Preferences }) {
  const save = useSavePreferences()
  const [alertLevel, setAlertLevel] = useState(prefs.alertLevel)
  const [interests, setInterests] = useState<string[]>(prefs.interestTypes)
  const [txOptin, setTxOptin] = useState(prefs.txAlertOptin)
  const [digestOn, setDigestOn] = useState(prefs.dailyDigestEnabled)
  const [digestTime, setDigestTime] = useState(hhmm(prefs.dailyDigestTime) || '08:00')
  const [dndStart, setDndStart] = useState(hhmm(prefs.dndStart))
  const [dndEnd, setDndEnd] = useState(hhmm(prefs.dndEnd))

  const toggleInterest = (code: string) =>
    setInterests((s) => (s.includes(code) ? s.filter((v) => v !== code) : [...s, code]))

  const submit = () =>
    save.mutate({
      alertLevel,
      interestTypes: interests,
      watchRegions: prefs.watchRegions.map((r) => ({ guName: r.guName, bjdCode: r.bjdCode })),
      txAlertOptin: txOptin,
      dailyDigestEnabled: digestOn,
      dailyDigestTime: orNull(digestTime),
      dndStart: orNull(dndStart),
      dndEnd: orNull(dndEnd),
    })

  return (
    <>
      <section>
        <h2 className="mb-3 text-base font-extrabold tracking-tight">알림 강도</h2>
        <div className="flex flex-col gap-2.5">
          {ALERT_LEVELS.map((a) => {
            const on = alertLevel === a.code
            return (
              <button
                key={a.code}
                type="button"
                onClick={() => setAlertLevel(a.code)}
                className={`flex items-center justify-between gap-3 rounded-[14px] border px-4 py-3.5 text-left ${
                  on ? 'border-mint/45 bg-mint/[0.08]' : 'border-white/[0.07] bg-surface'
                }`}
              >
                <span className="flex flex-col gap-0.5">
                  <span className="text-[15px] font-bold">{a.label}</span>
                  <span className="text-[13px] text-muted">{a.desc}</span>
                </span>
                <span className={`flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full border-[1.5px] ${on ? 'border-mint' : 'border-[#3a4456]'}`}>
                  {on && <span className="h-[11px] w-[11px] rounded-full bg-mint" />}
                </span>
              </button>
            )
          })}
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-base font-extrabold tracking-tight">관심 유형</h2>
        <div className="flex flex-wrap gap-2.5">
          {INTEREST_TYPES.map((t) => (
            <Chip key={t.code} selected={interests.includes(t.code)} disabled={!t.available} onClick={() => toggleInterest(t.code)}>
              {t.label}
            </Chip>
          ))}
        </div>
      </section>

      <section className="space-y-3.5 rounded-[15px] border border-white/[0.06] bg-surface p-4">
        <label className="flex items-center justify-between text-sm">
          <span className="text-ink-2">실거래 즉시 알림</span>
          <input type="checkbox" className="accent-mint" checked={txOptin} onChange={(e) => setTxOptin(e.target.checked)} />
        </label>
        <label className="flex items-center justify-between text-sm">
          <span className="text-ink-2">하루 요약</span>
          <input type="checkbox" className="accent-mint" checked={digestOn} onChange={(e) => setDigestOn(e.target.checked)} />
        </label>
        {digestOn && (
          <label className="flex items-center justify-between text-sm">
            <span className="text-muted">요약 시각</span>
            <input type="time" value={digestTime} onChange={(e) => setDigestTime(e.target.value)} className={timeInput} />
          </label>
        )}
        <div className="flex items-center justify-between text-sm">
          <span className="text-ink-2">방해 금지</span>
          <span className="flex items-center gap-1.5">
            <input type="time" value={dndStart} onChange={(e) => setDndStart(e.target.value)} className={timeInput} />
            <span className="text-muted-2">~</span>
            <input type="time" value={dndEnd} onChange={(e) => setDndEnd(e.target.value)} className={timeInput} />
          </span>
        </div>
      </section>

      <button
        type="button"
        onClick={submit}
        disabled={save.isPending}
        className="w-full rounded-[14px] bg-mint py-3.5 text-sm font-bold text-mint-ink disabled:opacity-40"
      >
        {save.isPending ? '저장 중…' : '저장'}
      </button>
      {save.isSuccess && <p className="text-center text-xs text-mint">저장됐습니다.</p>}
      {save.isError && <p className="text-center text-xs text-coral">저장 실패</p>}
    </>
  )
}

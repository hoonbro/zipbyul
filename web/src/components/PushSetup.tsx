import { useState } from 'react'
import {
  isPushConfigured,
  isPushRegistered,
  registerPush,
  unregisterPush,
  type PushResult,
} from '../lib/firebase'
import { isIos, isStandalone } from '../lib/platform'

type Permission = 'default' | 'granted' | 'denied' | 'unsupported'

function readPermission(): Permission {
  return typeof Notification === 'undefined' ? 'unsupported' : Notification.permission
}

const REASON_TEXT: Record<Exclude<PushResult, { ok: true }>['reason'], string> = {
  'config-missing': '푸시 설정이 아직 준비되지 않았습니다.',
  unsupported: '이 브라우저에서는 푸시를 지원하지 않습니다.',
  denied: '알림 권한이 거부되었습니다. 브라우저 설정에서 허용해 주세요.',
  'no-token': '토큰 발급에 실패했습니다.',
  error: '알림 설정 중 오류가 발생했습니다.',
}

export default function PushSetup() {
  const [permission, setPermission] = useState<Permission>(readPermission)
  const [registered, setRegistered] = useState(isPushRegistered)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  const iosNeedsInstall = isIos() && !isStandalone()

  const enable = async () => {
    setBusy(true)
    setMsg(null)
    const result = await registerPush()
    setPermission(readPermission())
    setRegistered(isPushRegistered())
    setMsg(result.ok ? '알림이 켜졌습니다.' : REASON_TEXT[result.reason])
    setBusy(false)
  }

  const disable = async () => {
    setBusy(true)
    setMsg(null)
    try {
      await unregisterPush()
      setRegistered(false)
      setMsg('알림을 껐습니다.')
    } catch {
      setMsg('해제 중 오류가 발생했습니다.')
    }
    setBusy(false)
  }

  return (
    <section className="rounded-[15px] border border-white/[0.06] bg-surface p-4">
      <h2 className="mb-1.5 text-sm font-bold text-ink-2">푸시 알림</h2>

      {!isPushConfigured() ? (
        <p className="text-xs text-muted-2">푸시 설정 준비 중입니다.</p>
      ) : iosNeedsInstall ? (
        <p className="text-xs text-muted">
          iPhone은 공유 → <b className="text-ink-2">홈 화면에 추가</b> 후 앱을 열면 알림을 받을 수 있어요.
        </p>
      ) : permission === 'denied' ? (
        <p className="text-xs text-coral">{REASON_TEXT.denied}</p>
      ) : registered ? (
        <div className="flex items-center justify-between">
          <span className="text-xs text-mint">알림이 켜져 있습니다.</span>
          <button
            type="button"
            onClick={disable}
            disabled={busy}
            className="rounded-lg border border-white/10 px-3 py-1.5 text-sm text-muted disabled:opacity-50"
          >
            {busy ? '처리 중…' : '끄기'}
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={enable}
          disabled={busy}
          className="rounded-lg bg-mint px-4 py-2 text-sm font-bold text-mint-ink disabled:opacity-50"
        >
          {busy ? '설정 중…' : '알림 켜기'}
        </button>
      )}

      {msg && <p className="mt-2 text-xs text-muted-2">{msg}</p>}
    </section>
  )
}

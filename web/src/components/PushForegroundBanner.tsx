import { useEffect, useState } from 'react'
import { onForegroundMessage } from '../lib/firebase'

interface Toast {
  title: string
  body: string
}

/** 앱이 열려있을 때 도착한 푸시를 상단 배너로 잠깐 표시. */
export default function PushForegroundBanner() {
  const [toast, setToast] = useState<Toast | null>(null)

  useEffect(() => {
    let unsub = () => {}
    onForegroundMessage((payload) => {
      const n = payload.notification
      setToast({ title: n?.title ?? '집별 알림', body: n?.body ?? '' })
      setTimeout(() => setToast(null), 5000)
    }).then((fn) => {
      unsub = fn
    })
    return () => unsub()
  }, [])

  if (!toast) {
    return null
  }
  return (
    <div className="fixed left-1/2 top-2 z-50 w-[94%] max-w-[410px] -translate-x-1/2 rounded-2xl border border-mint/30 bg-surface-2 p-3 shadow-lg">
      <p className="text-sm font-semibold text-ink">{toast.title}</p>
      {toast.body && <p className="text-xs text-muted">{toast.body}</p>}
    </div>
  )
}

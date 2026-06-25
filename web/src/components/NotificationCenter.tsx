import { useEffect } from 'react'
import { useNotifications } from '../lib/hooks'

const CHANNEL_LABEL: Record<string, string> = { PUSH: '푸시', IN_APP: '앱내', DIGEST: '요약' }

function relativeTime(iso: string): string {
  const diffMin = Math.floor((Date.now() - new Date(iso).getTime()) / 60000)
  if (diffMin < 1) return '방금'
  if (diffMin < 60) return `${diffMin}분 전`
  const h = Math.floor(diffMin / 60)
  if (h < 24) return `${h}시간 전`
  const d = Math.floor(h / 24)
  if (d < 7) return `${d}일 전`
  return iso.slice(5, 10).replace('-', '.')
}

interface Props {
  open: boolean
  onClose: () => void
  /** 이 id보다 큰 알림은 '새 알림'으로 강조한다. */
  lastSeenId: number
}

/** 상단에서 내려오는 알림센터 패널. 종 아이콘으로 연다. */
export default function NotificationCenter({ open, onClose, lastSeenId }: Props) {
  const { data, isLoading, isError } = useNotifications()

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  return (
    <div className={`fixed inset-0 z-50 ${open ? '' : 'pointer-events-none'}`} aria-hidden={!open}>
      <div
        onClick={onClose}
        className={`absolute inset-0 bg-black/55 transition-opacity duration-200 ${open ? 'opacity-100' : 'opacity-0'}`}
      />
      <div
        className={`absolute left-1/2 top-0 flex max-h-[82%] w-full max-w-[430px] -translate-x-1/2 flex-col rounded-b-[20px] border-b border-white/[0.07] bg-surface shadow-2xl transition-transform duration-300 ${
          open ? 'translate-y-0' : '-translate-y-full'
        }`}
      >
        <div className="flex items-center justify-between px-[18px] pb-3 pt-[calc(env(safe-area-inset-top)_+_14px)]">
          <h2 className="text-base font-extrabold tracking-tight">알림</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="닫기"
            className="flex h-8 w-8 items-center justify-center rounded-lg bg-surface-2 text-[15px] text-muted"
          >
            ✕
          </button>
        </div>

        <div className="overflow-y-auto px-[18px] pb-5">
          {isLoading && <p className="py-8 text-center text-sm text-muted-2">불러오는 중…</p>}
          {isError && <p className="py-8 text-center text-sm text-coral">알림을 불러오지 못했습니다.</p>}
          {data && data.length === 0 && (
            <p className="py-12 text-center text-sm text-muted-2">받은 알림이 없습니다.</p>
          )}
          <ul className="space-y-1.5">
            {data?.map((n) => {
              const unseen = n.id > lastSeenId
              return (
                <li
                  key={n.id}
                  className="flex gap-3 rounded-[14px] border border-white/[0.06] bg-surface-2/60 px-3.5 py-3"
                >
                  <span
                    className={`mt-[7px] h-2 w-2 shrink-0 rounded-full ${
                      unseen ? 'bg-mint' : 'border border-muted-2/50 bg-transparent'
                    }`}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="truncate text-[15px] font-bold text-ink">{n.title ?? '알림'}</span>
                      <span className="shrink-0 font-mono text-[11px] text-muted-2">{relativeTime(n.sentAt)}</span>
                    </div>
                    {n.body && <p className="mt-0.5 line-clamp-2 text-[13px] leading-snug text-muted">{n.body}</p>}
                    <div className="mt-1.5 flex items-center gap-1.5">
                      <span className="rounded-md bg-white/[0.05] px-1.5 py-0.5 text-[10px] text-muted-2">
                        {CHANNEL_LABEL[n.channel] ?? n.channel}
                      </span>
                      {n.status === 'FAILED' && (
                        <span className="rounded-md bg-red/15 px-1.5 py-0.5 text-[10px] text-coral">발송실패</span>
                      )}
                    </div>
                  </div>
                </li>
              )
            })}
          </ul>
        </div>
      </div>
    </div>
  )
}

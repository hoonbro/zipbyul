import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { ensureAnonymousId } from './lib/anonymousUser'

type State = { phase: 'loading' } | { phase: 'ready' } | { phase: 'error'; message: string }

function toErrorMessage(e: unknown): string {
  return e instanceof Error ? e.message : String(e)
}

/** 앱 시작 시 익명 식별자 발급을 보장한 뒤 자식을 렌더한다. 실패 시 원인 표시 + 재시도. */
export default function AppBoot({ children }: { children: ReactNode }) {
  const [state, setState] = useState<State>({ phase: 'loading' })

  const retry = useCallback(() => {
    setState({ phase: 'loading' })
    ensureAnonymousId()
      .then(() => setState({ phase: 'ready' }))
      .catch((e) => setState({ phase: 'error', message: toErrorMessage(e) }))
  }, [])

  useEffect(() => {
    ensureAnonymousId()
      .then(() => setState({ phase: 'ready' }))
      .catch((e) => setState({ phase: 'error', message: toErrorMessage(e) }))
  }, [])

  if (state.phase === 'loading') {
    return (
      <div className="flex h-full items-center justify-center text-sm text-muted-2">
        집별 시작 중…
      </div>
    )
  }

  if (state.phase === 'error') {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center">
        <p className="text-sm font-semibold text-ink">시작 중 문제가 발생했어요</p>
        <p className="text-xs text-muted-2">{state.message}</p>
        <button
          type="button"
          onClick={retry}
          className="rounded-lg bg-mint px-4 py-2 text-sm font-bold text-mint-ink"
        >
          다시 시도
        </button>
      </div>
    )
  }

  return <>{children}</>
}

import { useEffect, useState, type ReactNode } from 'react'
import { ensureAnonymousId } from './lib/anonymousUser'

/** 앱 시작 시 익명 식별자 발급을 보장한 뒤 자식을 렌더한다. 실패해도 진행(페이지가 개별 처리). */
export default function AppBoot({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false)

  useEffect(() => {
    ensureAnonymousId()
      .catch(() => undefined)
      .finally(() => setReady(true))
  }, [])

  if (!ready) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-muted-2">
        집별 시작 중…
      </div>
    )
  }
  return <>{children}</>
}

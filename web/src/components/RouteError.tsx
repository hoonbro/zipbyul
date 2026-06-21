import { Link, useRouteError } from 'react-router-dom'

export default function RouteError() {
  const error = useRouteError()
  return (
    <div className="mx-auto flex h-full max-w-[430px] flex-col items-center justify-center gap-3 bg-bg p-6 text-center">
      <p className="text-sm font-semibold text-ink">문제가 발생했습니다</p>
      <p className="text-xs text-muted-2">{error instanceof Error ? error.message : String(error)}</p>
      <Link to="/" className="text-sm text-mint underline">
        홈으로
      </Link>
    </div>
  )
}

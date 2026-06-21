import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { usePreferences } from '../lib/hooks'

const ONBOARDING_PATH = '/onboarding'

/**
 * 첫 실행(관심지역·관심유형 모두 비어있음) 사용자를 온보딩으로 유도한다.
 * 설정을 한 번이라도 채운 사용자는 그대로 통과.
 */
export default function OnboardingGate() {
  const location = useLocation()
  const { data, isLoading, isError } = usePreferences()

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-muted-2">
        설정 확인 중…
      </div>
    )
  }

  // 설정 조회 실패 시 막지 않고 진행 (각 화면이 자체 처리)
  const needsOnboarding =
    !isError && data != null && data.interestTypes.length === 0 && data.watchRegions.length === 0

  if (needsOnboarding && location.pathname !== ONBOARDING_PATH) {
    return <Navigate to={ONBOARDING_PATH} replace />
  }

  return <Outlet />
}

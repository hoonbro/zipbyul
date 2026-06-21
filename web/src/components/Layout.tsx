import { Suspense, type ReactNode } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import PushForegroundBanner from './PushForegroundBanner'

const icon: Record<string, ReactNode> = {
  radar: (
    <>
      <circle cx="12" cy="12" r="2.5" />
      <circle cx="12" cy="12" r="8" opacity="0.55" />
      <path d="M12 12l5.6-5.6" />
    </>
  ),
  calendar: (
    <>
      <rect x="3.5" y="5" width="17" height="16" rx="3" />
      <path d="M3.5 10h17M8 3v4M16 3v4" />
    </>
  ),
  news: (
    <>
      <rect x="4" y="4" width="16" height="16" rx="2.5" />
      <path d="M8 9h8M8 13h8M8 17h5" />
    </>
  ),
  index: (
    <>
      <path d="M4 14a8 8 0 0 1 16 0" />
      <path d="M12 14l4-3.5" />
      <circle cx="12" cy="14" r="1.6" fill="currentColor" stroke="none" />
    </>
  ),
  settings: (
    <>
      <path d="M4 6h9M17 6h3M4 12h3M11 12h9M4 18h11M19 18h1" />
      <circle cx="15" cy="6" r="2" />
      <circle cx="9" cy="12" r="2" />
      <circle cx="17" cy="18" r="2" />
    </>
  ),
}

const tabs = [
  { to: '/', label: '레이더', key: 'radar', end: true },
  { to: '/calendar', label: '캘린더', key: 'calendar' },
  { to: '/news', label: '뉴스', key: 'news' },
  { to: '/market-outlook', label: '지수', key: 'index' },
  { to: '/settings', label: '설정', key: 'settings' },
]

export default function Layout() {
  return (
    <div className="mx-auto flex h-full max-w-[430px] flex-col bg-bg">
      <PushForegroundBanner />
      <main className="flex-1 overflow-y-auto px-[18px] pt-2 pb-24">
        <Suspense fallback={<p className="text-sm text-muted-2">불러오는 중…</p>}>
          <Outlet />
        </Suspense>
      </main>
      <nav className="fixed bottom-0 left-1/2 flex h-[68px] w-full max-w-[430px] -translate-x-1/2 border-t border-white/[0.07] bg-bg/90 pb-1.5 backdrop-blur-md">
        {tabs.map((t) => (
          <NavLink
            key={t.to}
            to={t.to}
            end={t.end}
            className={({ isActive }) =>
              `flex flex-1 flex-col items-center justify-center gap-1 ${
                isActive ? 'text-mint' : 'text-muted-2'
              }`
            }
          >
            <svg
              width="22"
              height="22"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
            >
              {icon[t.key]}
            </svg>
            <span className="text-[10px] font-semibold">{t.label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  )
}

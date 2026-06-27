/* eslint-disable react-refresh/only-export-components -- 라우트 설정 파일(컴포넌트 모듈 아님) */
import { lazy } from 'react'
import { createBrowserRouter } from 'react-router-dom'
import Layout from './components/Layout'
import OnboardingGate from './components/OnboardingGate'
import RouteError from './components/RouteError'
import Home from './pages/Home'
import Onboarding from './pages/Onboarding'
import News from './pages/News'
import Calendar from './pages/Calendar'
import Announcements from './pages/Announcements'
import AnnouncementDetail from './pages/AnnouncementDetail'
import WatchRegions from './pages/WatchRegions'
import Transactions from './pages/Transactions'
import NotificationSettings from './pages/NotificationSettings'

// recharts가 무거워 집값전망만 코드스플릿
const MarketOutlook = lazy(() => import('./pages/MarketOutlook'))

export const router = createBrowserRouter([
  {
    path: '/',
    element: <OnboardingGate />,
    errorElement: <RouteError />,
    children: [
      // 온보딩은 하단 네비 없이 (레이아웃 밖)
      { path: 'onboarding', element: <Onboarding /> },
      {
        element: <Layout />,
        children: [
          { index: true, element: <Home /> },
          { path: 'news', element: <News /> },
          { path: 'market-outlook', element: <MarketOutlook /> },
          { path: 'calendar', element: <Calendar /> },
          { path: 'announcements', element: <Announcements /> },
          { path: 'announcements/:id', element: <AnnouncementDetail /> },
          { path: 'watch', element: <WatchRegions /> },
          { path: 'transactions', element: <Transactions /> },
          { path: 'settings', element: <NotificationSettings /> },
        ],
      },
    ],
  },
])

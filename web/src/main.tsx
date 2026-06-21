import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClientProvider } from '@tanstack/react-query'
import { RouterProvider } from 'react-router-dom'
import './index.css'
import { queryClient } from './lib/queryClient'
import { router } from './router'
import AppBoot from './AppBoot'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <AppBoot>
        <RouterProvider router={router} />
      </AppBoot>
    </QueryClientProvider>
  </StrictMode>,
)

import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: '집별 — 서울 부동산 레이더',
        short_name: '집별',
        description: '관심지역 청약·공공임대·실거래·집값전망을 한눈에',
        lang: 'ko',
        theme_color: '#080b12',
        background_color: '#080b12',
        display: 'standalone',
        start_url: '/',
        icons: [
          // 임시 단색 아이콘 — 출시 전 디자인 아이콘으로 교체
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: '/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        navigateFallback: '/index.html',
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
      },
    }),
  ],
})

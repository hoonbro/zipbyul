// 표준 WebPush(VAPID) 서비스워커. iOS PWA 등 FCM이 안 붙는 환경에서 사용한다.
// 스코프를 /webpush/ 로 분리해 Workbox(vite-plugin-pwa, 스코프 /)·FCM SW와 충돌을 피한다.
// 서버 WebPushSender가 보내는 payload: {"title": "...", "body": "..."}

self.addEventListener('push', (event) => {
  let data = {}
  try {
    data = event.data ? event.data.json() : {}
  } catch (e) {
    data = { title: '집별', body: event.data ? event.data.text() : '' }
  }
  const title = data.title || '집별'
  const options = {
    body: data.body || '',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
  }
  event.waitUntil(self.registration.showNotification(title, options))
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      const existing = clients.find((c) => 'focus' in c)
      if (existing) {
        return existing.focus()
      }
      return self.clients.openWindow('/')
    }),
  )
})

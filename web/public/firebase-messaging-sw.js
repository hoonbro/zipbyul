// FCM 백그라운드 메시지 수신용 서비스워커.
// 실제 값으로 채워야 동작 (Firebase 콘솔 웹 config). 빌드 env가 SW엔 주입 안 되므로 직접 기입한다.
// 참고: vite-plugin-pwa(Workbox) SW와 별개 스코프로 공존한다.
importScripts('https://www.gstatic.com/firebasejs/11.0.0/firebase-app-compat.js')
importScripts('https://www.gstatic.com/firebasejs/11.0.0/firebase-messaging-compat.js')

// TODO: 실제 config로 교체
firebase.initializeApp({
  apiKey: 'REPLACE_ME',
  projectId: 'zipbyul',
  messagingSenderId: 'REPLACE_ME',
  appId: 'REPLACE_ME',
})

firebase.messaging()

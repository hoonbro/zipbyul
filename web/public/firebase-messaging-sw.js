// FCM 백그라운드 메시지 수신용 서비스워커.
// 실제 값으로 채워야 동작 (Firebase 콘솔 웹 config). 빌드 env가 SW엔 주입 안 되므로 직접 기입한다.
// 참고: vite-plugin-pwa(Workbox) SW와 별개 스코프로 공존한다.
importScripts('https://www.gstatic.com/firebasejs/11.0.0/firebase-app-compat.js')
importScripts('https://www.gstatic.com/firebasejs/11.0.0/firebase-messaging-compat.js')

firebase.initializeApp({
  apiKey: 'AIzaSyCQ1XqA8iLFZz4CzOWI0e7ZbC4pcBXctZw',
  projectId: 'zipbyul',
  messagingSenderId: '948368663536',
  appId: '1:948368663536:web:ea3de55fae31389dde7335',
})

firebase.messaging()

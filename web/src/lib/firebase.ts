import { initializeApp, type FirebaseApp } from 'firebase/app'
import {
  getMessaging,
  getToken,
  isSupported,
  onMessage,
  type MessagePayload,
  type Messaging,
} from 'firebase/messaging'
import { apiFetch } from './api'
import type { DeviceResponse } from './types'

const DEVICE_ID_KEY = 'jb_device_id'

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
}

export type PushResult =
  | { ok: true; token: string }
  | { ok: false; reason: 'config-missing' | 'unsupported' | 'denied' | 'no-token' | 'error' }

/** 웹 푸시 환경설정(Firebase config + VAPID 공개키)이 채워졌는지. */
export function isPushConfigured(): boolean {
  return Boolean(import.meta.env.VITE_FIREBASE_API_KEY && import.meta.env.VITE_VAPID_PUBLIC_KEY)
}

let app: FirebaseApp | null = null
let messaging: Messaging | null = null

async function getMessagingIfSupported(): Promise<Messaging | null> {
  if (!isPushConfigured() || !(await isSupported())) {
    return null
  }
  if (!app) {
    app = initializeApp(firebaseConfig)
  }
  if (!messaging) {
    messaging = getMessaging(app)
  }
  return messaging
}

/**
 * 푸시 권한 요청 → FCM 토큰 발급 → 백엔드 기기 등록(POST /v1/devices).
 * SW는 firebase-messaging-sw.js를 명시 등록해 Workbox SW와 분리한다.
 * iOS는 16.4+ & 홈화면 설치 PWA에서만 동작.
 */
export async function registerPush(): Promise<PushResult> {
  if (!isPushConfigured()) {
    return { ok: false, reason: 'config-missing' }
  }
  const m = await getMessagingIfSupported()
  if (!m) {
    return { ok: false, reason: 'unsupported' }
  }
  try {
    const permission = await Notification.requestPermission()
    if (permission !== 'granted') {
      return { ok: false, reason: 'denied' }
    }
    const swReg = await navigator.serviceWorker.register('/firebase-push/firebase-messaging-sw.js')
    const token = await getToken(m, {
      vapidKey: import.meta.env.VITE_VAPID_PUBLIC_KEY,
      serviceWorkerRegistration: swReg,
    })
    if (!token) {
      return { ok: false, reason: 'no-token' }
    }
    const device = await apiFetch<DeviceResponse>('/v1/devices', {
      method: 'POST',
      body: { deviceToken: token },
      withAnonymousId: true,
    })
    localStorage.setItem(DEVICE_ID_KEY, String(device.id))
    return { ok: true, token }
  } catch {
    return { ok: false, reason: 'error' }
  }
}

export function isPushRegistered(): boolean {
  return localStorage.getItem(DEVICE_ID_KEY) != null
}

/** 기기 등록 해제(알림 끄기). 토큰 자체는 브라우저에 남지만 백엔드 발송 대상에서 제거. */
export async function unregisterPush(): Promise<void> {
  const id = localStorage.getItem(DEVICE_ID_KEY)
  if (id) {
    await apiFetch(`/v1/devices/${id}`, { method: 'DELETE', withAnonymousId: true })
    localStorage.removeItem(DEVICE_ID_KEY)
  }
}

/** 포그라운드(앱이 열려있을 때) 수신 메시지 구독. 반환값으로 구독 해제. */
export async function onForegroundMessage(
  cb: (payload: MessagePayload) => void,
): Promise<() => void> {
  const m = await getMessagingIfSupported()
  if (!m) {
    return () => {}
  }
  return onMessage(m, cb)
}

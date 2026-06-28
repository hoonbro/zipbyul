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
    // FCM 미지원(iOS PWA 등) → 표준 WebPush 폴백
    return supportsWebPush() ? subscribeWebPush() : { ok: false, reason: 'unsupported' }
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
      body: { kind: 'FCM', deviceToken: token },
      withAnonymousId: true,
    })
    localStorage.setItem(DEVICE_ID_KEY, String(device.id))
    return { ok: true, token }
  } catch {
    return { ok: false, reason: 'error' }
  }
}

function supportsWebPush(): boolean {
  return (
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    typeof Notification !== 'undefined'
  )
}

function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4)
  const normalized = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(normalized)
  const out = new Uint8Array(new ArrayBuffer(raw.length))
  for (let i = 0; i < raw.length; i += 1) {
    out[i] = raw.charCodeAt(i)
  }
  return out
}

/**
 * 표준 WebPush(VAPID) 구독 → 백엔드 기기 등록. iOS는 16.4+ & 홈화면 설치 PWA에서만 동작.
 * VAPID 공개키는 서버(/v1/push/vapid-public-key)에서 받아 단일 출처를 유지한다.
 */
async function subscribeWebPush(): Promise<PushResult> {
  try {
    const permission = await Notification.requestPermission()
    if (permission !== 'granted') {
      return { ok: false, reason: 'denied' }
    }
    const reg = await navigator.serviceWorker.register('/webpush/webpush-sw.js', {
      scope: '/webpush/',
    })
    const { publicKey } = await apiFetch<{ publicKey: string }>('/v1/push/vapid-public-key')
    if (!publicKey) {
      return { ok: false, reason: 'config-missing' }
    }
    const sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey),
    })
    const json = sub.toJSON()
    if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) {
      return { ok: false, reason: 'no-token' }
    }
    const device = await apiFetch<DeviceResponse>('/v1/devices', {
      method: 'POST',
      body: {
        kind: 'WEBPUSH',
        endpoint: json.endpoint,
        p256dh: json.keys.p256dh,
        auth: json.keys.auth,
      },
      withAnonymousId: true,
    })
    localStorage.setItem(DEVICE_ID_KEY, String(device.id))
    return { ok: true, token: json.endpoint }
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

import { apiFetch } from './api'

const STORAGE_KEY = 'jb_anonymous_id'

export interface AnonymousUser {
  anonymousId: string
  status: string
  createdAt: string
}

// iOS 프라이빗 모드 등 localStorage가 막힌 환경에서도 세션은 동작하도록 메모리 사본을 둔다.
let memoryId: string | null = null

function readStored(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY)
  } catch {
    return null
  }
}

function writeStored(id: string): void {
  try {
    localStorage.setItem(STORAGE_KEY, id)
  } catch {
    // 스토리지 차단 — 메모리 사본으로 세션 유지(다음 실행 시 재발급)
  }
}

export function getAnonymousId(): string | null {
  return memoryId ?? readStored()
}

/**
 * 최초 접속 시 익명 식별자를 발급받아 보관한다. 이미 있으면 그대로 반환.
 * localStorage는 best-effort이고, 발급된 ID는 메모리에 항상 보관한다.
 */
export async function ensureAnonymousId(): Promise<string> {
  const existing = getAnonymousId()
  if (existing) {
    memoryId = existing
    return existing
  }
  const user = await apiFetch<AnonymousUser>('/v1/anonymous-users', { method: 'POST' })
  memoryId = user.anonymousId
  writeStored(user.anonymousId)
  return user.anonymousId
}

export function clearAnonymousId(): void {
  memoryId = null
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch {
    // noop
  }
}

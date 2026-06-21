import { apiFetch } from './api'

const STORAGE_KEY = 'jb_anonymous_id'

export interface AnonymousUser {
  anonymousId: string
  status: string
  createdAt: string
}

export function getAnonymousId(): string | null {
  return localStorage.getItem(STORAGE_KEY)
}

/**
 * 최초 접속 시 익명 식별자를 발급받아 localStorage에 보관한다.
 * 이미 있으면 그대로 반환. (localStorage 삭제 시 복구 불가 — UX 안내 필요)
 */
export async function ensureAnonymousId(): Promise<string> {
  const existing = getAnonymousId()
  if (existing) {
    return existing
  }
  const user = await apiFetch<AnonymousUser>('/v1/anonymous-users', { method: 'POST' })
  localStorage.setItem(STORAGE_KEY, user.anonymousId)
  return user.anonymousId
}

export function clearAnonymousId(): void {
  localStorage.removeItem(STORAGE_KEY)
}

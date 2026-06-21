import { getAnonymousId } from './anonymousUser'

const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8080'

/** 백엔드 공통 에러 envelope (contracts/openapi.yaml ErrorResponse). */
export interface ApiErrorBody {
  code: string
  message: string
  traceId: string
}

export class ApiError extends Error {
  readonly status: number
  readonly code: string
  readonly traceId?: string

  constructor(status: number, body: ApiErrorBody) {
    super(body.message)
    this.status = status
    this.code = body.code
    this.traceId = body.traceId
  }
}

interface RequestOptions {
  method?: string
  body?: unknown
  /** true면 X-Anonymous-Id 헤더 부착 (비회원 식별 필요한 엔드포인트). */
  withAnonymousId?: boolean
}

export async function apiFetch<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  const headers: Record<string, string> = { Accept: 'application/json' }
  if (opts.body !== undefined) {
    headers['Content-Type'] = 'application/json'
  }
  if (opts.withAnonymousId) {
    const id = getAnonymousId()
    if (id) {
      headers['X-Anonymous-Id'] = id
    }
  }

  const res = await fetch(`${BASE_URL}${path}`, {
    method: opts.method ?? 'GET',
    headers,
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  })

  if (res.status === 204) {
    return undefined as T
  }

  const text = await res.text()
  const data = text ? JSON.parse(text) : undefined

  if (!res.ok) {
    const body: ApiErrorBody = data?.error ?? {
      code: 'UNKNOWN',
      message: res.statusText,
      traceId: '',
    }
    throw new ApiError(res.status, body)
  }
  return data as T
}

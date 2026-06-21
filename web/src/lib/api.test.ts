import { http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'
import { server } from '../test/server'
import { apiFetch } from './api'

const BASE = 'http://localhost:8080'

describe('apiFetch', () => {
  it('parses success json', async () => {
    server.use(http.get(`${BASE}/v1/ping`, () => HttpResponse.json({ ok: true })))
    const res = await apiFetch<{ ok: boolean }>('/v1/ping')
    expect(res.ok).toBe(true)
  })

  it('throws ApiError carrying envelope code/status', async () => {
    server.use(
      http.get(`${BASE}/v1/bad`, () =>
        HttpResponse.json(
          { error: { code: 'INVALID_REGION', message: '지원하지 않는 자치구', traceId: 't' } },
          { status: 400 },
        ),
      ),
    )
    await expect(apiFetch('/v1/bad')).rejects.toMatchObject({ code: 'INVALID_REGION', status: 400 })
  })

  it('returns undefined for 204', async () => {
    server.use(http.delete(`${BASE}/v1/x`, () => new HttpResponse(null, { status: 204 })))
    const res = await apiFetch('/v1/x', { method: 'DELETE' })
    expect(res).toBeUndefined()
  })
})

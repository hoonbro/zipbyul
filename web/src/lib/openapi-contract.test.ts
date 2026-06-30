/// <reference types="node" />
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const openapi = readFileSync(resolve(process.cwd(), '../contracts/openapi.yaml'), 'utf8')

function pathSection(path: string): string {
  const marker = `  ${path}:`
  const start = openapi.indexOf(marker)
  expect(start, `${path} should be documented`).toBeGreaterThanOrEqual(0)
  const next = openapi.indexOf('\n  /', start + marker.length)
  return next === -1 ? openapi.slice(start) : openapi.slice(start, next)
}

describe('OpenAPI contract smoke checks', () => {
  it('documents public paths used by the web app', () => {
    [
      '/v1/anonymous-users',
      '/v1/preferences',
      '/v1/devices',
      '/v1/devices/{id}',
      '/v1/push/vapid-public-key',
      '/v1/me/data',
      '/v1/feed/home',
      '/v1/market-index/house-price-outlook',
      '/v1/regions',
      '/v1/calendar',
      '/v1/announcements',
      '/v1/announcements/{id}',
      '/v1/transactions/recent',
      '/v1/complexes',
      '/v1/complexes/detail',
      '/v1/watch/regions/summary',
      '/v1/watch/complexes',
      '/v1/notifications',
    ].forEach((path) => {
      expect(pathSection(path)).toContain(path)
    })
  })

  it('keeps transaction filters in the contract', () => {
    const transactions = pathSection('/v1/transactions/recent')
    ;[
      'tradeType',
      'areaMin',
      'areaMax',
      'priceMin',
      'priceMax',
      'floorMin',
      'floorMax',
      'buildYearMin',
      'buildYearMax',
      'contractFrom',
      'contractTo',
      'recentDays',
    ].forEach((param) => {
      expect(transactions).toContain(`name: ${param}`)
    })
  })

  it('keeps response fields used by notification and transaction screens', () => {
    ;[
      'title: { type: [string, \'null\'] }',
      'body: { type: [string, \'null\'] }',
      'buildYear: { type: [integer, \'null\'] }',
      'registeredAt: { type: [string, \'null\'], format: date }',
      'monthlyRentManwon: { type: [integer, \'null\'], format: int64 }',
      'ComplexDetail:',
      'ComplexSummaryItem:',
      'RegionItem:',
    ].forEach((field) => {
      expect(openapi).toContain(field)
    })
  })
})

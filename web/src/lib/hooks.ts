import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiFetch } from './api'
import type {
  AnnouncementDetail,
  AnnouncementList,
  CalendarItem,
  ComplexSearchItem,
  ComplexSummaryItem,
  FeedHome,
  HousePriceOutlook,
  NotificationLogItem,
  Preferences,
  RecentTransaction,
  RegionItem,
  RegionSummaryItem,
} from './types'

export function useFeedHome() {
  return useQuery({
    queryKey: ['feed', 'home'],
    queryFn: () => apiFetch<FeedHome>('/v1/feed/home', { withAnonymousId: true }),
  })
}

export function usePreferences() {
  return useQuery({
    queryKey: ['preferences'],
    queryFn: () => apiFetch<Preferences>('/v1/preferences', { withAnonymousId: true }),
  })
}

export interface SavePreferencesInput {
  alertLevel: string
  interestTypes: string[]
  watchRegions: { guName: string; bjdCode?: string | null }[]
  txAlertOptin?: boolean
  dailyDigestEnabled?: boolean
  dailyDigestTime?: string | null
  dndStart?: string | null
  dndEnd?: string | null
}

export function useSavePreferences() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: SavePreferencesInput) =>
      apiFetch<Preferences>('/v1/preferences', {
        method: 'PUT',
        body: input,
        withAnonymousId: true,
      }),
    onSuccess: (data) => {
      qc.setQueryData(['preferences'], data)
      qc.invalidateQueries({ queryKey: ['feed'] })
      qc.invalidateQueries({ queryKey: ['watch'] })
    },
  })
}

export function useHousePriceOutlook() {
  return useQuery({
    queryKey: ['market-index', 'house-price-outlook'],
    queryFn: () => apiFetch<HousePriceOutlook>('/v1/market-index/house-price-outlook'),
  })
}

export interface CalendarParams {
  from?: string
  to?: string
  type?: string
  region?: string
}

export function useCalendar(params: CalendarParams) {
  const qs = new URLSearchParams()
  if (params.from) qs.set('from', params.from)
  if (params.to) qs.set('to', params.to)
  if (params.type) qs.set('type', params.type)
  if (params.region) qs.set('region', params.region)
  const query = qs.toString()
  return useQuery({
    queryKey: ['calendar', params],
    queryFn: () => apiFetch<CalendarItem[]>(`/v1/calendar${query ? `?${query}` : ''}`),
  })
}

export interface AnnouncementParams {
  region?: string
  supplyType?: string
  page?: number
  size?: number
}

export function useAnnouncements(params: AnnouncementParams) {
  const qs = new URLSearchParams()
  if (params.region) qs.set('region', params.region)
  if (params.supplyType) qs.set('supplyType', params.supplyType)
  if (params.page != null) qs.set('page', String(params.page))
  if (params.size != null) qs.set('size', String(params.size))
  const query = qs.toString()
  return useQuery({
    queryKey: ['announcements', params],
    queryFn: () => apiFetch<AnnouncementList>(`/v1/announcements${query ? `?${query}` : ''}`),
  })
}

export function useAnnouncement(id: number) {
  return useQuery({
    queryKey: ['announcement', id],
    queryFn: () => apiFetch<AnnouncementDetail>(`/v1/announcements/${id}`),
  })
}

export function useDeleteMyData() {
  return useMutation({
    mutationFn: () => apiFetch<void>('/v1/me/data', { method: 'DELETE', withAnonymousId: true }),
  })
}

export function useWatchSummary() {
  return useQuery({
    queryKey: ['watch', 'summary'],
    queryFn: () => apiFetch<RegionSummaryItem[]>('/v1/watch/regions/summary', { withAnonymousId: true }),
  })
}

export function useWatchComplexes() {
  return useQuery({
    queryKey: ['watch', 'complexes'],
    queryFn: () => apiFetch<ComplexSummaryItem[]>('/v1/watch/complexes', { withAnonymousId: true }),
  })
}

export function useComplexSearch(gu: string | null, q: string) {
  const term = q.trim()
  return useQuery({
    queryKey: ['complexes', gu, term],
    enabled: !!gu,
    queryFn: () => {
      const qs = new URLSearchParams({ gu: gu! })
      if (term) qs.set('q', term)
      return apiFetch<ComplexSearchItem[]>(`/v1/complexes?${qs.toString()}`)
    },
  })
}

export function useAddWatchComplex() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: { guName: string; complexNorm: string; displayName: string }) =>
      apiFetch<void>('/v1/watch/complexes', { method: 'POST', body: input, withAnonymousId: true }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['watch', 'complexes'] }),
  })
}

export function useRemoveWatchComplex() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: { guName: string; complexNorm: string }) => {
      const qs = new URLSearchParams({ guName: input.guName, complexNorm: input.complexNorm })
      return apiFetch<void>(`/v1/watch/complexes?${qs.toString()}`, {
        method: 'DELETE',
        withAnonymousId: true,
      })
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['watch', 'complexes'] }),
  })
}

export function useRegions(gu: string | null) {
  return useQuery({
    queryKey: ['regions', gu],
    enabled: !!gu,
    queryFn: () => apiFetch<RegionItem[]>(`/v1/regions?gu=${encodeURIComponent(gu!)}`),
  })
}

export interface RecentTransactionParams {
  region?: string
  dong?: string
  bjdCode?: string
  tradeType?: string
  areaMin?: number
  areaMax?: number
}

export function useRecentTransactions(params: RecentTransactionParams) {
  const qs = new URLSearchParams()
  if (params.region) qs.set('region', params.region)
  if (params.dong) qs.set('dong', params.dong)
  if (params.bjdCode) qs.set('bjdCode', params.bjdCode)
  if (params.tradeType) qs.set('tradeType', params.tradeType)
  if (params.areaMin != null) qs.set('areaMin', String(params.areaMin))
  if (params.areaMax != null) qs.set('areaMax', String(params.areaMax))
  const query = qs.toString()
  return useQuery({
    queryKey: ['transactions', 'recent', params],
    queryFn: () =>
      apiFetch<{ items: RecentTransaction[]; notice: string }>(
        `/v1/transactions/recent${query ? `?${query}` : ''}`,
      ),
  })
}

export function useNotifications() {
  return useQuery({
    queryKey: ['notifications'],
    queryFn: () => apiFetch<NotificationLogItem[]>('/v1/notifications', { withAnonymousId: true }),
  })
}

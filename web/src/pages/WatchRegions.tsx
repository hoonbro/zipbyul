import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import { SortableContext, arrayMove, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import Chip from '../components/Chip'
import { ALERT_LEVELS, INTEREST_TYPES, SEOUL_GU } from '../lib/constants'
import {
  useAddWatchComplex,
  useComplexSearch,
  usePreferences,
  useRegions,
  useRemoveWatchComplex,
  useSavePreferences,
  useWatchComplexes,
  useWatchSummary,
} from '../lib/hooks'
import type { Preferences } from '../lib/types'

export default function WatchRegions() {
  const [searchParams] = useSearchParams()
  const [tab, setTab] = useState<'region' | 'complex'>(
    searchParams.get('tab') === 'complex' ? 'complex' : 'region',
  )
  const editMode = searchParams.get('mode') === 'edit'

  return (
    <div className="space-y-5">
      <h1 className="mt-1.5 text-[21px] font-extrabold tracking-tight">
        {tab === 'region' && !editMode ? '관심지역 움직임' : '관심지역·단지'}
      </h1>

      <div className="flex rounded-[14px] border border-white/[0.08] bg-surface p-1">
        <TabButton active={tab === 'region'} onClick={() => setTab('region')}>
          지역
        </TabButton>
        <TabButton active={tab === 'complex'} onClick={() => setTab('complex')}>
          단지
        </TabButton>
      </div>

      {tab === 'region' ? <RegionTab editMode={editMode} /> : <ComplexSection />}
    </div>
  )
}

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex-1 rounded-[11px] py-2.5 text-sm font-bold transition-colors ${
        active ? 'bg-mint text-mint-ink' : 'text-muted-2'
      }`}
    >
      {children}
    </button>
  )
}

const SUMMARY_PREVIEW = 6

function RegionTab({ editMode }: { editMode: boolean }) {
  const summary = useWatchSummary()
  const prefs = usePreferences()
  const [showAll, setShowAll] = useState(false)

  const items = summary.data ?? []
  const visible = showAll ? items : items.slice(0, SUMMARY_PREVIEW)

  if (editMode) {
    return (
      <div className="space-y-5">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-extrabold tracking-tight">관심지역 편집</h2>
          <Link to="/watch" className="text-xs font-bold text-muted-2">
            요약 보기 ›
          </Link>
        </div>
        {prefs.data ? (
          <RegionEditor prefs={prefs.data} />
        ) : (
          <p className="text-sm text-muted-2">설정 불러오는 중…</p>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <SettingsSummary prefs={prefs.data} loading={prefs.isLoading} />

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-extrabold tracking-tight">지역별 움직임</h2>
          <Link to="/watch?mode=edit" className="text-xs font-bold text-muted-2">
            편집 ›
          </Link>
        </div>
        {summary.isLoading && <p className="text-sm text-muted-2">불러오는 중…</p>}
        {summary.data && items.length === 0 && (
          <p className="text-sm text-muted-2">선택한 관심지역이 없습니다.</p>
        )}
        <ul className="space-y-2.5">
          {visible.map((r) => (
            <li key={r.regionName} className="rounded-[16px] border border-white/[0.06] bg-surface px-4 py-3.5">
              <div className="mb-3 flex items-center gap-2.5">
                <span className="h-2 w-2 rounded-full bg-mint" style={{ boxShadow: '0 0 7px #3df5c5' }} />
                <span className="text-[16px] font-extrabold">{r.regionName}</span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <StatLink
                  to={regionPath('/announcements', r.regionName, { openOnly: 'true' })}
                  v={r.announcementCount}
                  k="공고"
                  color="#5ba8ff"
                />
                <StatLink
                  to={regionPath('/calendar', r.regionName, {
                    view: 'dday',
                    period: '7days',
                    type: 'APPLICATION_DEADLINE',
                  })}
                  v={r.deadlineCount}
                  k="마감임박"
                  color="#ffce5a"
                />
                <StatLink
                  to={regionPath('/transactions', r.regionName, { recentDays: '7' })}
                  v={r.recentTransactionCount}
                  k="실거래"
                  color="#3df5c5"
                />
              </div>
            </li>
          ))}
        </ul>
        {items.length > SUMMARY_PREVIEW && (
          <button
            type="button"
            onClick={() => setShowAll((s) => !s)}
            className="mt-2.5 w-full rounded-[12px] border border-white/[0.08] py-2.5 text-xs font-bold text-muted-2"
          >
            {showAll ? '접기 ▴' : `전체 ${items.length}개 보기 ▾`}
          </button>
        )}
      </section>

    </div>
  )
}

function regionPath(path: string, regionName: string, extra: Record<string, string>) {
  const qs = new URLSearchParams({ region: regionName, ...extra })
  return `${path}?${qs.toString()}`
}

function SettingsSummary({ prefs, loading }: { prefs: Preferences | undefined; loading: boolean }) {
  if (loading) return <p className="text-sm text-muted-2">관심지역 설정 불러오는 중…</p>
  if (!prefs) return null

  const regions = [...new Set(prefs.watchRegions.map((r) => r.guName))]
  const dongCount = prefs.watchRegions.filter((r) => r.bjdCode).length
  const alertLabel = ALERT_LEVELS.find((a) => a.code === prefs.alertLevel)?.label ?? prefs.alertLevel
  const labels = prefs.interestTypes.map((code) => INTEREST_TYPES.find((t) => t.code === code)?.label ?? code)
  const interestText = labels.length === 0 ? '미선택' : labels.length <= 2 ? labels.join(' · ') : `${labels.slice(0, 2).join(' · ')} 외 ${labels.length - 2}`

  return (
    <section className="rounded-[16px] border border-white/[0.06] bg-surface px-4 py-3.5">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-base font-extrabold tracking-tight">관심지역 설정 요약</h2>
        <Link to="/watch?mode=edit" className="text-xs font-bold text-mint">
          수정
        </Link>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <SummaryPill k="지역" v={`${regions.length}개`} sub={dongCount > 0 ? `동 ${dongCount}개 좁힘` : '자치구 전체'} />
        <SummaryPill k="관심유형" v={interestText} sub={`${prefs.interestTypes.length}개 선택`} />
        <SummaryPill k="알림강도" v={alertLabel} sub={prefs.txAlertOptin ? '실거래 즉시 알림 켬' : '실거래 즉시 알림 꺼짐'} />
        <SummaryPill k="정렬" v="우선순위 순" sub={regions.slice(0, 2).join(' · ') || '지역 없음'} />
      </div>
    </section>
  )
}

function SummaryPill({ k, v, sub }: { k: string; v: string; sub: string }) {
  return (
    <div className="min-w-0 rounded-[12px] bg-bg/55 px-3 py-2.5">
      <div className="text-[10px] font-bold text-muted-2">{k}</div>
      <div className="mt-1 truncate text-[13px] font-extrabold">{v}</div>
      <div className="mt-0.5 truncate text-[10px] text-muted-2">{sub}</div>
    </div>
  )
}

function formatEok(manwon: number | null): string {
  if (manwon == null) return '—'
  if (manwon < 10000) return `${manwon.toLocaleString()}만`
  const eok = Math.floor(manwon / 10000)
  const rest = manwon % 10000
  return rest === 0 ? `${eok}억` : `${eok}억 ${rest.toLocaleString()}만`
}

function ComplexSection() {
  const navigate = useNavigate()
  const watched = useWatchComplexes()
  const remove = useRemoveWatchComplex()
  const [gu, setGu] = useState('')
  const [query, setQuery] = useState('')
  const search = useComplexSearch(gu || null, query)
  const add = useAddWatchComplex()

  const watchedKeys = new Set((watched.data ?? []).map((c) => `${c.guName}|${c.complexNorm}`))

  return (
    <section>
      <h2 className="mb-3 text-base font-extrabold tracking-tight">관심단지</h2>

      {watched.isLoading && <p className="text-sm text-muted-2">불러오는 중…</p>}
      {watched.data && watched.data.length === 0 && (
        <p className="text-sm text-muted-2">선택한 관심단지가 없습니다. 아래에서 검색해 추가하세요.</p>
      )}
      <ul className="space-y-2.5">
        {watched.data?.map((c) => (
          <li key={`${c.guName}|${c.complexNorm}`} className="overflow-hidden rounded-[16px] border border-white/[0.08] bg-surface">
            <button
              type="button"
              onClick={() =>
                navigate(
                  `/complex?gu=${encodeURIComponent(c.guName)}&norm=${encodeURIComponent(c.complexNorm)}&name=${encodeURIComponent(c.displayName)}`,
                )
              }
              className="flex w-full items-center gap-2 px-4 pt-4 text-left"
            >
              <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-mint" style={{ boxShadow: '0 0 7px #3df5c5' }} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[16px] font-extrabold tracking-tight">{c.displayName}</span>
                <span className="mt-0.5 block text-[12px] text-muted-2">{c.guName}</span>
              </span>
              <span className="shrink-0 text-muted-2">›</span>
            </button>
            <div className="flex gap-2 px-4 pb-4 pt-3.5">
              <StatBox v={c.recentTransactionCount} k="최근거래" color="#3df5c5" bg="rgba(61,245,197,.12)" />
              <StatBox v={formatEok(c.latestSalePriceManwon)} k="최근매매" color="#5ba8ff" bg="rgba(91,168,255,.12)" />
              <StatBox v={c.openAnnouncementCount} k="진행공고" color="#ffce5a" bg="rgba(255,206,90,.12)" />
            </div>
            <button
              type="button"
              onClick={() => remove.mutate({ guName: c.guName, complexNorm: c.complexNorm })}
              className="w-full border-t border-white/[0.06] py-2.5 text-xs text-muted-2 active:bg-white/[0.03]"
            >
              관심단지 삭제
            </button>
          </li>
        ))}
      </ul>

      <div className="mt-4 rounded-[15px] border border-white/[0.06] bg-surface px-4 py-3.5">
        <div className="mb-2.5 text-sm font-bold">단지 추가</div>
        <div className="flex gap-2">
          <select
            value={gu}
            onChange={(e) => setGu(e.target.value)}
            className="rounded-[12px] border border-white/[0.08] bg-bg px-3 py-2.5 text-sm"
          >
            <option value="">자치구</option>
            {SEOUL_GU.map((g) => (
              <option key={g} value={g}>
                {g}
              </option>
            ))}
          </select>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="단지명 검색"
            className="flex-1 rounded-[12px] border border-white/[0.08] bg-bg px-3 py-2.5 text-sm"
          />
        </div>

        {gu && (
          <div className="mt-3">
            {search.isLoading && <p className="text-xs text-muted-2">검색 중…</p>}
            {search.data && search.data.length === 0 && (
              <p className="text-xs text-muted-2">검색 결과가 없습니다.</p>
            )}
            <ul className="space-y-1.5">
              {search.data?.map((r) => {
                const added = watchedKeys.has(`${r.guName}|${r.complexNorm}`)
                return (
                  <li key={r.complexNorm} className="flex items-center justify-between">
                    <span className="text-sm">{r.displayName}</span>
                    <button
                      type="button"
                      disabled={added || add.isPending}
                      onClick={() =>
                        add.mutate({ guName: r.guName, complexNorm: r.complexNorm, displayName: r.displayName })
                      }
                      className="rounded-full bg-mint px-3 py-1 text-xs font-bold text-mint-ink disabled:opacity-40"
                    >
                      {added ? '추가됨' : '추가'}
                    </button>
                  </li>
                )
              })}
            </ul>
          </div>
        )}
      </div>
    </section>
  )
}

function StatLink({ to, v, k, color }: { to: string; v: number; k: string; color: string }) {
  return (
    <Link to={to} className="rounded-[12px] bg-bg/55 px-2 py-3 text-center active:bg-white/[0.04]">
      <div className="font-mono text-[18px] font-bold leading-none" style={{ color }}>
        {v}
      </div>
      <div className="mt-1.5 text-[10px] font-bold text-muted-2">{k} ›</div>
    </Link>
  )
}

function StatBox({ v, k, color, bg }: { v: string | number; k: string; color: string; bg: string }) {
  return (
    <div className="flex flex-1 flex-col items-center gap-1.5 rounded-[12px] px-2 py-3" style={{ background: bg }}>
      <span className="font-mono text-[17px] font-bold leading-none" style={{ color }}>{v}</span>
      <span className="text-[10px] text-muted">{k}</span>
    </div>
  )
}

function RegionEditor({ prefs }: { prefs: Preferences }) {
  const save = useSavePreferences()
  const [selected, setSelected] = useState<string[]>(() =>
    [...new Set(prefs.watchRegions.map((r) => r.guName))],
  )
  const [dongsByGu, setDongsByGu] = useState<Record<string, string[]>>(() => {
    const init: Record<string, string[]> = {}
    for (const r of prefs.watchRegions) {
      if (r.bjdCode) (init[r.guName] ??= []).push(r.bjdCode)
    }
    return init
  })

  const allSelected = selected.length === SEOUL_GU.length
  const toggleAll = () => setSelected(allSelected ? [] : [...SEOUL_GU])

  const toggle = (gu: string) =>
    setSelected((s) => (s.includes(gu) ? s.filter((v) => v !== gu) : [...s, gu]))

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }))
  const onDragEnd = (e: DragEndEvent) => {
    const { active, over } = e
    if (over && active.id !== over.id) {
      setSelected((s) => arrayMove(s, s.indexOf(active.id as string), s.indexOf(over.id as string)))
    }
  }

  const toggleDong = (gu: string, bjdCode: string) =>
    setDongsByGu((m) => {
      const cur = m[gu] ?? []
      const next = cur.includes(bjdCode) ? cur.filter((v) => v !== bjdCode) : [...cur, bjdCode]
      return { ...m, [gu]: next }
    })

  const submit = () => {
    const watchRegions = selected.flatMap((guName) => [
      { guName, bjdCode: null },
      ...(dongsByGu[guName] ?? []).map((bjdCode) => ({ guName, bjdCode })),
    ])
    save.mutate({
      alertLevel: prefs.alertLevel,
      interestTypes: prefs.interestTypes,
      watchRegions,
      txAlertOptin: prefs.txAlertOptin,
      dailyDigestEnabled: prefs.dailyDigestEnabled,
      dailyDigestTime: prefs.dailyDigestTime,
      dndStart: prefs.dndStart,
      dndEnd: prefs.dndEnd,
    })
  }

  return (
    <section>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-base font-extrabold tracking-tight">지역 편집 (자치구)</h2>
        <button type="button" onClick={toggleAll} className="text-xs font-bold text-mint">
          {allSelected ? '전체 해제' : '전체 선택'}
        </button>
      </div>
      <div className="flex flex-wrap gap-2.5">
        {SEOUL_GU.map((gu) => (
          <Chip key={gu} selected={selected.includes(gu)} onClick={() => toggle(gu)}>
            {gu}
          </Chip>
        ))}
      </div>

      {selected.length > 0 && (
        <div className="mt-5 space-y-2.5">
          <p className="text-xs text-muted-2">≡ 를 끌어 우선순위를 바꾸고, 자치구를 펼쳐 동을 선택하세요 (선택 안 하면 자치구 전체).</p>
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
            <SortableContext items={selected} strategy={verticalListSortingStrategy}>
              <div className="space-y-2.5">
                {selected.map((gu, i) => (
                  <DongNarrowing
                    key={gu}
                    gu={gu}
                    rank={i + 1}
                    selected={dongsByGu[gu] ?? []}
                    onToggle={(bjd) => toggleDong(gu, bjd)}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        </div>
      )}

      <button
        type="button"
        onClick={submit}
        disabled={save.isPending}
        className="mt-5 w-full rounded-[14px] bg-mint py-3.5 text-sm font-bold text-mint-ink disabled:opacity-40"
      >
        {save.isPending ? '저장 중…' : '저장'}
      </button>
      {save.isSuccess && <p className="mt-2 text-center text-xs text-mint">저장됐습니다.</p>}
      {save.isError && <p className="mt-2 text-center text-xs text-coral">저장 실패</p>}
    </section>
  )
}

function DongNarrowing({
  gu,
  rank,
  selected,
  onToggle,
}: {
  gu: string
  rank: number
  selected: string[]
  onToggle: (bjdCode: string) => void
}) {
  const [open, setOpen] = useState(false)
  const regions = useRegions(open ? gu : null) // 펼칠 때만 동 목록 로드
  const label = selected.length === 0 ? '동 전체' : `${selected.length}개 선택`

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: gu })
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
    zIndex: isDragging ? 10 : undefined,
  }

  return (
    <div ref={setNodeRef} style={style} className="rounded-[15px] border border-white/[0.06] bg-surface">
      <div className="flex items-center">
        <button
          type="button"
          {...attributes}
          {...listeners}
          aria-label="드래그로 우선순위 변경"
          className="cursor-grab touch-none px-3 py-3.5 text-base text-muted-2"
        >
          ≡
        </button>
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="flex flex-1 items-center justify-between py-3.5 pr-4"
        >
          <span className="flex items-center gap-2">
            <span className="flex h-5 w-5 items-center justify-center rounded-md bg-mint/15 font-mono text-[11px] font-bold text-mint">
              {rank}
            </span>
            <span className="text-sm font-bold">{gu}</span>
          </span>
          <span className="flex items-center gap-2 text-xs text-muted-2">
            {label}
            <span>{open ? '▴' : '▾'}</span>
          </span>
        </button>
      </div>
      {open && (
        <div className="border-t border-white/[0.06] px-4 py-3.5">
          {regions.isLoading && <p className="text-xs text-muted-2">동 목록 불러오는 중…</p>}
          {regions.data && (
            <div className="flex flex-wrap gap-2">
              {regions.data.map((r) => (
                <Chip key={r.bjdCode} selected={selected.includes(r.bjdCode)} onClick={() => onToggle(r.bjdCode)}>
                  {r.dongName}
                </Chip>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

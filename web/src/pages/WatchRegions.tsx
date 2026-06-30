import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
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
import { SEOUL_GU } from '../lib/constants'
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
  const [tab, setTab] = useState<'region' | 'complex'>('region')

  return (
    <div className="space-y-5">
      <h1 className="mt-1.5 text-[21px] font-extrabold tracking-tight">관심지역·단지</h1>

      <div className="flex rounded-[14px] border border-white/[0.08] bg-surface p-1">
        <TabButton active={tab === 'region'} onClick={() => setTab('region')}>
          지역
        </TabButton>
        <TabButton active={tab === 'complex'} onClick={() => setTab('complex')}>
          단지
        </TabButton>
      </div>

      {tab === 'region' ? <RegionTab /> : <ComplexSection />}
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

function RegionTab() {
  const summary = useWatchSummary()
  const prefs = usePreferences()
  const [showAll, setShowAll] = useState(false)

  const items = summary.data ?? []
  const visible = showAll ? items : items.slice(0, SUMMARY_PREVIEW)

  return (
    <div className="space-y-6">
      <section>
        <h2 className="mb-3 text-base font-extrabold tracking-tight">요약</h2>
        {summary.isLoading && <p className="text-sm text-muted-2">불러오는 중…</p>}
        {summary.data && items.length === 0 && (
          <p className="text-sm text-muted-2">선택한 관심지역이 없습니다.</p>
        )}
        <ul className="space-y-2.5">
          {visible.map((r) => (
            <li key={r.regionName} className="flex items-center justify-between rounded-[15px] border border-white/[0.06] bg-surface px-4 py-3.5">
              <div className="flex items-center gap-2.5">
                <span className="h-[7px] w-[7px] rounded-full bg-mint" style={{ boxShadow: '0 0 7px #3df5c5' }} />
                <span className="text-[15px] font-bold">{r.regionName}</span>
              </div>
              <div className="flex gap-3.5">
                <Stat v={r.announcementCount} k="공고" color="#5ba8ff" />
                <Stat v={r.deadlineCount} k="마감임박" color="#ffce5a" />
                <Stat v={r.recentTransactionCount} k="실거래" color="#3df5c5" />
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

      {prefs.data ? (
        <RegionEditor prefs={prefs.data} />
      ) : (
        <p className="text-sm text-muted-2">설정 불러오는 중…</p>
      )}
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
          <li key={`${c.guName}|${c.complexNorm}`} className="rounded-[15px] border border-white/[0.06] bg-surface px-4 py-3.5">
            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={() =>
                  navigate(
                    `/complex?gu=${encodeURIComponent(c.guName)}&norm=${encodeURIComponent(c.complexNorm)}&name=${encodeURIComponent(c.displayName)}`,
                  )
                }
                className="text-left"
              >
                <div className="text-[15px] font-bold">{c.displayName} ›</div>
                <div className="mt-0.5 text-[11px] text-muted-2">{c.guName}</div>
              </button>
              <button
                type="button"
                onClick={() => remove.mutate({ guName: c.guName, complexNorm: c.complexNorm })}
                className="text-xs text-coral"
              >
                삭제
              </button>
            </div>
            <div className="mt-3 flex gap-3.5">
              <Stat v={c.recentTransactionCount} k="최근거래" color="#3df5c5" />
              <div className="text-center">
                <div className="font-mono text-[15px] font-bold text-[#5ba8ff]">{formatEok(c.latestSalePriceManwon)}</div>
                <div className="mt-px text-[10px] text-muted-2">최근매매</div>
              </div>
              <Stat v={c.openAnnouncementCount} k="진행공고" color="#ffce5a" />
            </div>
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

function Stat({ v, k, color }: { v: number; k: string; color: string }) {
  return (
    <div className="text-center">
      <div className="font-mono text-[15px] font-bold" style={{ color }}>
        {v}
      </div>
      <div className="mt-px text-[10px] text-muted-2">{k}</div>
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

import { useState } from 'react'
import { Link } from 'react-router-dom'
import Tag from '../components/Tag'
import { ANNOUNCEMENT_SUPPLY_FILTERS, SUPPLY_TYPE_LABELS } from '../lib/constants'
import { useAnnouncements } from '../lib/hooks'

const SIZE = 20

export default function Announcements() {
  const [supplyType, setSupplyType] = useState<string | undefined>(undefined)
  const [page, setPage] = useState(0)
  const { data, isLoading, isError } = useAnnouncements({ supplyType, page, size: SIZE })

  const pickType = (t: string | undefined) => {
    setSupplyType(t)
    setPage(0)
  }

  const totalPages = data ? Math.max(1, Math.ceil(data.totalCount / SIZE)) : 1
  const filters: (string | undefined)[] = [undefined, ...ANNOUNCEMENT_SUPPLY_FILTERS]

  return (
    <div className="space-y-4">
      <h1 className="mt-1.5 text-[21px] font-extrabold tracking-tight">공고</h1>

      <div className="flex gap-2 overflow-x-auto pb-0.5">
        {filters.map((s) => (
          <button
            key={s ?? 'all'}
            type="button"
            onClick={() => pickType(s)}
            className={`shrink-0 whitespace-nowrap rounded-full border px-4 py-2 text-[13px] font-semibold ${
              supplyType === s ? 'border-mint bg-mint text-mint-ink' : 'border-white/10 bg-surface text-muted'
            }`}
          >
            {s ? (SUPPLY_TYPE_LABELS[s] ?? s) : '전체'}
          </button>
        ))}
      </div>

      {isLoading && <p className="text-sm text-muted-2">불러오는 중…</p>}
      {isError && <p className="text-sm text-coral">공고를 불러오지 못했습니다.</p>}
      {data && data.totalCount === 0 && <p className="text-sm text-muted-2">공고가 없습니다.</p>}

      {data && <p className="text-xs text-muted-2">총 {data.totalCount}건</p>}

      <ul className="space-y-2.5">
        {data?.items.map((a) => (
          <li key={a.id}>
            <Link to={`/announcements/${a.id}`} className="block rounded-[15px] border border-white/[0.06] bg-surface p-3.5 active:bg-surface-2">
              <div className="mb-1.5 flex items-center gap-2">
                <Tag>{SUPPLY_TYPE_LABELS[a.supplyType ?? ''] ?? a.supplyType ?? '기타'}</Tag>
                {a.regionName && <span className="text-xs text-muted-2">{a.regionName}</span>}
              </div>
              <p className="truncate text-[15px] font-semibold">{a.title ?? '(제목 없음)'}</p>
              <p className="mt-1 font-mono text-xs text-muted">
                접수 {a.applyStart ?? '?'} ~ {a.applyEnd ?? '?'}
              </p>
            </Link>
          </li>
        ))}
      </ul>

      {data && data.totalCount > SIZE && (
        <div className="flex items-center justify-between pt-2">
          <button
            type="button"
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={page === 0}
            className="rounded-lg border border-white/10 px-4 py-2 text-sm text-muted disabled:opacity-30"
          >
            이전
          </button>
          <span className="text-xs text-muted-2">
            {page + 1} / {totalPages}
          </span>
          <button
            type="button"
            onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
            disabled={page >= totalPages - 1}
            className="rounded-lg border border-white/10 px-4 py-2 text-sm text-muted disabled:opacity-30"
          >
            다음
          </button>
        </div>
      )}
    </div>
  )
}

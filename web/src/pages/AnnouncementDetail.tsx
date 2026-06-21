import { Link, useParams } from 'react-router-dom'
import Tag from '../components/Tag'
import { SUPPLY_TYPE_LABELS } from '../lib/constants'
import { useAnnouncement } from '../lib/hooks'

export default function AnnouncementDetail() {
  const { id } = useParams()
  const { data, isLoading, isError, error } = useAnnouncement(Number(id))

  if (isLoading) return <p className="text-sm text-muted-2">불러오는 중…</p>
  if (isError || !data) {
    return (
      <div className="space-y-2">
        <p className="text-sm text-coral">공고를 찾을 수 없습니다. ({String(error)})</p>
        <Link to="/announcements" className="text-sm text-muted underline">
          목록으로
        </Link>
      </div>
    )
  }

  const rows: [string, string | null][] = [
    ['공급유형', SUPPLY_TYPE_LABELS[data.supplyType ?? ''] ?? data.supplyType],
    ['지역', data.regionName],
    ['접수 시작', data.applyStart],
    ['접수 마감', data.applyEnd],
    ['당첨자 발표', data.winnerAnnounceDate],
    ['계약', data.contractDate],
    ['공고번호', data.pblancNo],
  ]

  return (
    <div className="space-y-5">
      <Link to="/announcements" className="inline-block text-sm text-muted-2">
        ‹ 목록
      </Link>

      <div>
        <div className="mb-2.5">
          <Tag>{SUPPLY_TYPE_LABELS[data.supplyType ?? ''] ?? data.supplyType ?? '기타'}</Tag>
        </div>
        <h1 className="text-[22px] font-extrabold leading-snug tracking-tight">{data.title ?? '(제목 없음)'}</h1>
        <p className="mt-1.5 text-[13px] text-muted">
          {[data.regionName, data.sourceName].filter(Boolean).join(' · ')}
        </p>
      </div>

      <dl className="rounded-[16px] border border-white/[0.06] bg-surface px-4">
        {rows.map(([k, v], i) => (
          <div
            key={k}
            className={`flex items-center justify-between py-3 ${i < rows.length - 1 ? 'border-b border-white/[0.06]' : ''}`}
          >
            <dt className="text-[13px] text-muted">{k}</dt>
            <dd className="text-right text-sm font-semibold text-ink">{v ?? '-'}</dd>
          </div>
        ))}
      </dl>

      {data.summary && Object.keys(data.summary).length > 0 && (
        <section>
          <h2 className="mb-2.5 text-base font-extrabold">상세</h2>
          <dl className="rounded-[16px] border border-white/[0.06] bg-surface px-4">
            {Object.entries(data.summary).map(([k, v], i, arr) => (
              <div
                key={k}
                className={`flex items-center justify-between py-3 ${i < arr.length - 1 ? 'border-b border-white/[0.06]' : ''}`}
              >
                <dt className="text-[13px] text-muted">{k}</dt>
                <dd className="text-right text-sm font-semibold text-ink">{String(v)}</dd>
              </div>
            ))}
          </dl>
        </section>
      )}

      {data.sourceUrl && (
        <a
          href={data.sourceUrl}
          target="_blank"
          rel="noreferrer"
          className="flex h-[52px] items-center justify-center gap-2 rounded-[14px] border border-white/10 bg-surface-2 text-[15px] font-bold text-ink"
        >
          원문 공고 보기 {data.sourceName && <span className="text-mint">· {data.sourceName}</span>}
        </a>
      )}
    </div>
  )
}

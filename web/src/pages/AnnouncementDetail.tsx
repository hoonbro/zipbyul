import { Link, useParams } from 'react-router-dom'
import Tag from '../components/Tag'
import { SUPPLY_TYPE_LABELS } from '../lib/constants'
import { useAnnouncement } from '../lib/hooks'
import type { AnnouncementMargin, UnitMargin } from '../lib/types'

const GRADE: Record<string, { label: string; fg: string; bg: string }> = {
  HIGH: { label: '🟢 안전마진 높음', fg: '#3df5c5', bg: 'rgba(61,245,197,0.15)' },
  MID: { label: '🟡 안전마진 보통', fg: '#ffce5a', bg: 'rgba(255,206,90,0.15)' },
  LOW: { label: '마진 낮음', fg: '#8a97ab', bg: 'rgba(138,151,171,0.15)' },
  UNAVAILABLE: { label: '비교 데이터 부족', fg: '#8a97ab', bg: 'rgba(138,151,171,0.12)' },
}

const eok = (manwon: number | null): string => {
  if (manwon == null) return '-'
  const v = manwon / 10000
  return `${Number.isInteger(v) ? v : v.toFixed(1)}억`
}
const marginText = (manwon: number | null): string => {
  if (manwon == null) return '-'
  return `${manwon >= 0 ? '+' : '-'}${eok(Math.abs(manwon))}`
}

function MarginSection({ margin }: { margin: AnnouncementMargin }) {
  const rep = GRADE[margin.representativeGrade] ?? GRADE.UNAVAILABLE
  return (
    <section>
      <h2 className="mb-2.5 text-base font-extrabold">안전마진</h2>
      <div className="space-y-3 rounded-[16px] border border-white/[0.06] bg-surface p-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-md px-2 py-0.5 text-xs font-bold" style={{ color: rep.fg, background: rep.bg }}>
            {rep.label}
          </span>
          {margin.priceCap && <span className="rounded-md bg-white/10 px-2 py-0.5 text-xs font-bold text-muted-2">분상제</span>}
          {margin.unranked && <span className="rounded-md bg-white/10 px-2 py-0.5 text-xs font-bold text-muted-2">무순위</span>}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-right text-[13px]">
            <thead>
              <tr className="text-[11px] text-muted">
                <th className="py-1.5 text-left font-semibold">주택형</th>
                <th className="py-1.5 font-semibold">전용</th>
                <th className="py-1.5 font-semibold">분양가</th>
                <th className="py-1.5 font-semibold">인근시세</th>
                <th className="py-1.5 font-semibold">마진</th>
                <th className="py-1.5 font-semibold">등급</th>
              </tr>
            </thead>
            <tbody>
              {margin.units.map((u: UnitMargin, i) => {
                const g = GRADE[u.grade] ?? GRADE.UNAVAILABLE
                return (
                  <tr key={`${u.houseType}-${i}`} className="border-t border-white/[0.06]">
                    <td className="py-2 text-left font-semibold text-ink">{u.houseType ?? '-'}</td>
                    <td className="py-2 text-muted-2">{u.areaM2 != null ? `${u.areaM2}㎡` : '-'}</td>
                    <td className="py-2 text-muted-2">{eok(u.supplyAmountManwon)}</td>
                    <td className="py-2 text-muted-2">{u.grade === 'UNAVAILABLE' ? '-' : eok(u.marketMedianManwon)}</td>
                    <td className="py-2 font-semibold" style={{ color: u.marginManwon != null && u.marginManwon >= 0 ? '#3df5c5' : '#8a97ab' }}>
                      {marginText(u.marginManwon)}
                    </td>
                    <td className="py-2">
                      <span className="rounded px-1.5 py-0.5 text-[10px] font-bold" style={{ color: g.fg, background: g.bg }}>
                        {g.label.replace(/^[🟢🟡⚪]\s*/u, '').replace('안전마진 ', '')}
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        <p className="text-[11px] text-muted">
          근거: {margin.basisRegion} · 최근 {margin.basisMonths}개월 실거래(전용 ±5㎡) 중앙값 · 자치구 단위
        </p>
        <p className="text-[11px] leading-relaxed text-muted-2">
          추정치이며 투자 권유가 아닙니다. 옵션·확장비 제외, 실거래 표본 기반. 투자 판단의 책임은 사용자에게 있습니다.
        </p>
      </div>
    </section>
  )
}

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

      {data.margin && data.margin.units.length > 0 && <MarginSection margin={data.margin} />}

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

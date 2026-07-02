import { Link, useParams } from 'react-router-dom'
import { ListSkeleton } from '../components/LoadingSkeleton'
import Tag from '../components/Tag'
import { SUPPLY_TYPE_LABELS } from '../lib/constants'
import { useAnnouncement } from '../lib/hooks'
import type { AnnouncementMargin, UnitMargin } from '../lib/types'

const GRADE: Record<string, { label: string; fg: string; bg: string }> = {
  HIGH: { label: '🟢 경쟁력 높음', fg: '#3df5c5', bg: 'rgba(61,245,197,0.15)' },
  MID: { label: '🟡 경쟁력 보통', fg: '#ffce5a', bg: 'rgba(255,206,90,0.15)' },
  LOW: { label: '⚪ 경쟁력 낮음', fg: '#8a97ab', bg: 'rgba(138,151,171,0.15)' },
  UNAVAILABLE: { label: '⚪ 비교 데이터 부족', fg: '#8a97ab', bg: 'rgba(138,151,171,0.12)' },
}

// 비교 기준 단위 (백엔드 basisLevel). 동·구 단계는 준신축만 비교(신축 보정).
const BASIS_LABEL: Record<string, string> = {
  COMPLEX: '같은 단지 실거래',
  PRESALE: '인근 분양권 실거래',
  PRESALE_GU: '자치구·분양권 실거래',
  DONG: '같은 동·준신축 실거래',
  GU: '자치구·준신축 실거래',
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
const ratioText = (ratio: number | null): string => {
  if (ratio == null) return ''
  return `${ratio >= 0 ? '+' : ''}${(ratio * 100).toFixed(0)}%`
}
// 전용면적 기준 평당가(3.3㎡당, 만원). 공급면적 미수집이라 전용 기준임을 표 하단에 명시.
const pyeongPrice = (manwon: number | null, areaM2: number | null): string => {
  if (manwon == null || areaM2 == null || areaM2 === 0) return ''
  return `평당 ${Math.round(manwon / (areaM2 / 3.3058)).toLocaleString()}만`
}

function MarginSection({ margin }: { margin: AnnouncementMargin }) {
  const rep = GRADE[margin.representativeGrade] ?? GRADE.UNAVAILABLE
  return (
    <section>
      <h2 className="mb-2.5 text-base font-extrabold">가격 경쟁력</h2>
      <div className="space-y-3 rounded-[16px] border border-white/[0.06] bg-surface p-4">
        {(margin.representativeGrade !== 'LOW' || margin.priceCap || margin.unranked) && (
          <div className="flex flex-wrap items-center gap-2">
            {margin.representativeGrade !== 'LOW' && (
              <span className="rounded-md px-2 py-0.5 text-xs font-bold" style={{ color: rep.fg, background: rep.bg }}>
                {rep.label}
              </span>
            )}
            {margin.priceCap && <span className="rounded-md bg-white/10 px-2 py-0.5 text-xs font-bold text-muted-2">분상제</span>}
            {margin.unranked && <span className="rounded-md bg-white/10 px-2 py-0.5 text-xs font-bold text-muted-2">무순위</span>}
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-center text-[13px]">
            <thead>
              <tr className="text-[11px] text-muted">
                <th className="py-1.5 font-semibold">주택형</th>
                <th className="py-1.5 font-semibold">세대수</th>
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
                    <td className="py-2 font-semibold text-ink">{u.houseType ?? '-'}</td>
                    <td className="py-2 text-muted-2">{u.supplyCount != null ? `${u.supplyCount}` : '-'}</td>
                    <td className="py-2 text-muted-2">
                      {eok(u.supplyAmountManwon)}
                      {pyeongPrice(u.supplyAmountManwon, u.areaM2) && (
                        <div className="text-[10px] text-muted">{pyeongPrice(u.supplyAmountManwon, u.areaM2)}</div>
                      )}
                    </td>
                    <td className="py-2 text-muted-2">{u.grade === 'UNAVAILABLE' ? '-' : eok(u.marketMedianManwon)}</td>
                    <td className="py-2 font-semibold" style={{ color: u.marginManwon != null && u.marginManwon >= 0 ? '#3df5c5' : '#8a97ab' }}>
                      {marginText(u.marginManwon)}
                      {u.grade !== 'UNAVAILABLE' && u.marginRatio != null && (
                        <div className="text-[10px] font-normal text-muted">{ratioText(u.marginRatio)}</div>
                      )}
                    </td>
                    <td className="py-2">
                      <span className="rounded px-1.5 py-0.5 text-[10px] font-bold" style={{ color: g.fg, background: g.bg }}>
                        {g.label.replace(/^[🟢🟡⚪]\s*/u, '').replace('경쟁력 ', '')}
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        <p className="text-[11px] text-muted">
          근거: {margin.basisRegion} · {margin.basisLevel ? BASIS_LABEL[margin.basisLevel] : '인근 실거래'} · 최근 {margin.basisMonths}개월(전용 ±5㎡) 중앙값 · 평당가는 전용면적 기준
        </p>
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.04] px-3 py-2">
          <p className="text-[11px] leading-relaxed text-muted-2">
            추정치이며 투자 권유가 아닙니다. 옵션·확장비 제외, 실거래 표본 기반. 투자 판단의 책임은 사용자에게 있습니다.
          </p>
        </div>
      </div>
    </section>
  )
}

export default function AnnouncementDetail() {
  const { id } = useParams()
  const { data, isLoading, isError, error } = useAnnouncement(Number(id))

  if (isLoading) return <ListSkeleton rows={3} />
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

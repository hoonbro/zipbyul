import { ddayLook } from '../lib/colors'

/** D-day 배지 (목업 dday()). */
export default function DDayBadge({ dDay }: { dDay: number }) {
  const l = ddayLook(dDay)
  return (
    <span
      className="whitespace-nowrap rounded-lg px-2.5 py-1 font-mono text-xs font-bold tracking-wide"
      style={{ color: l.fg, background: l.bg }}
    >
      {l.text}
    </span>
  )
}

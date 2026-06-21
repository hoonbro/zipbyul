import { categoryColor } from '../lib/colors'

/** 카테고리 태그 칩 (목업 tag()). 색은 라벨에서 유도. */
export default function Tag({ children }: { children: string }) {
  const c = categoryColor(children)
  return (
    <span
      className="inline-block whitespace-nowrap rounded-md px-2 py-0.5 text-[11px] font-bold"
      style={{ color: c, background: `${c}22` }}
    >
      {children}
    </span>
  )
}

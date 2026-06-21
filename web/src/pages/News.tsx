const SOON_ITEMS = [
  '관심지역·관심유형 기준으로 부동산 뉴스 모아보기',
  '기사 3줄 AI 요약과 쉬운 말 설명',
  '뉴스 중요도 별점·카테고리 필터',
  '지표·일정과 연결된 관련 뉴스',
]

export default function News() {
  return (
    <div className="space-y-4">
      <div className="mt-1.5 flex items-center gap-2">
        <h1 className="text-[21px] font-extrabold tracking-tight">뉴스</h1>
        <span className="rounded-md border border-violet/30 bg-violet/15 px-2 py-0.5 font-mono text-[10px] font-bold text-violet">
          개발 예정
        </span>
      </div>

      <div className="relative overflow-hidden rounded-[20px] border border-violet/20 bg-gradient-to-br from-[#11142a] to-[#0c0f1c] px-5 py-8 text-center">
        <div
          className="pointer-events-none absolute inset-0"
          style={{ background: 'radial-gradient(110% 80% at 50% 0%,rgba(124,140,255,0.14),transparent 60%)' }}
        />
        <div className="relative">
          <div className="mx-auto mb-4 flex h-[60px] w-[60px] items-center justify-center rounded-[18px] border border-violet/30 bg-violet/15">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#9aa7ff" strokeWidth="1.7" strokeLinecap="round">
              <rect x="4" y="4" width="16" height="16" rx="2.5" />
              <path d="M8 9h8M8 13h8M8 17h5" />
            </svg>
          </div>
          <p className="mb-2 text-lg font-extrabold tracking-tight">뉴스 · AI 요약은 2차 기능이에요</p>
          <p className="mx-auto max-w-[280px] text-[13px] leading-relaxed text-ink-2">
            1차 MVP는 공식 OpenAPI 기반 일정·공고·실거래·집값 전망 심리에 집중해요. 뉴스 수집과 AI
            요약은 출처·저작권·요약 품질을 검증한 뒤 추가할 예정이에요.
          </p>
        </div>
      </div>

      <p className="px-0.5 text-[13px] font-bold text-muted">2차에서 제공될 내용</p>
      <ul className="space-y-2">
        {SOON_ITEMS.map((t) => (
          <li
            key={t}
            className="flex items-center gap-3 rounded-2xl border border-dashed border-violet/25 bg-soon px-4 py-3.5"
          >
            <span className="h-2 w-2 shrink-0 rounded-full bg-violet" />
            <span className="text-[13px] leading-snug text-ink-2">{t}</span>
          </li>
        ))}
      </ul>

      <div className="flex gap-2 rounded-2xl border border-violet/20 bg-violet/[0.07] px-4 py-3.5">
        <span className="text-[13px] text-violet">ⓘ</span>
        <span className="text-xs leading-relaxed text-ink-2">
          뉴스 요약은 참고용으로만 제공되며, 일정·금액·자격 등 수치는 공식 원문을 기준으로 표시할
          예정이에요.
        </span>
      </div>
    </div>
  )
}

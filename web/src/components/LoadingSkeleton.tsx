interface ListSkeletonProps {
  rows?: number
}

function Block({ className }: { className: string }) {
  return <div className={`animate-pulse rounded-md bg-white/[0.07] ${className}`} aria-hidden="true" />
}

export function ListSkeleton({ rows = 4 }: ListSkeletonProps) {
  return (
    <div className="space-y-2.5" aria-label="불러오는 중">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="rounded-[15px] border border-white/[0.06] bg-surface p-3.5">
          <div className="mb-2 flex items-center gap-2">
            <Block className="h-5 w-14" />
            <Block className="h-3 w-12" />
          </div>
          <Block className="mb-2 h-4 w-4/5" />
          <Block className="h-3 w-1/2" />
        </div>
      ))}
    </div>
  )
}

export function HomeSkeleton() {
  return (
    <div className="space-y-6" aria-label="홈 피드를 불러오는 중">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <Block className="h-[30px] w-[30px] rounded-[9px]" />
          <Block className="h-5 w-12" />
        </div>
        <Block className="h-[34px] w-[34px] rounded-[10px]" />
      </div>
      <div className="rounded-[20px] border border-mint/10 bg-surface p-5">
        <Block className="mb-3 h-3 w-36" />
        <Block className="mb-2 h-3 w-24" />
        <Block className="mb-2 h-8 w-44" />
        <div className="mt-4 flex gap-2">
          <Block className="h-6 w-20" />
          <Block className="h-6 w-24" />
        </div>
      </div>
      <div>
        <Block className="mb-3 h-5 w-20" />
        <div className="flex gap-2.5">
          <Block className="h-[82px] flex-1 rounded-[15px]" />
          <Block className="h-[82px] flex-1 rounded-[15px]" />
          <Block className="h-[82px] flex-1 rounded-[15px]" />
        </div>
      </div>
      <ListSkeleton rows={3} />
    </div>
  )
}

export function MarketSkeleton() {
  return (
    <div className="space-y-3.5" aria-label="시장 지수를 불러오는 중">
      <div className="mt-1.5">
        <Block className="mb-2 h-6 w-24" />
        <Block className="h-4 w-44" />
      </div>
      <div className="rounded-[20px] border border-mint/10 bg-surface px-[18px] pb-[18px] pt-5">
        <div className="mb-6 flex items-center justify-between">
          <Block className="h-5 w-32" />
          <Block className="h-5 w-14" />
        </div>
        <div className="mb-5 flex items-end justify-between">
          <Block className="h-4 w-20" />
          <Block className="h-12 w-20" />
        </div>
        <Block className="mb-5 h-2.5 w-full rounded-full" />
        <Block className="h-44 w-full rounded-xl" />
      </div>
      <Block className="h-[86px] rounded-[20px]" />
      <Block className="h-[86px] rounded-[20px]" />
    </div>
  )
}

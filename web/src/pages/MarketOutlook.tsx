import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { MarketSkeleton } from '../components/LoadingSkeleton'
import { useHousePriceOutlook } from '../lib/hooks'

// CSI는 100 중심. 표시용 밴드 범위(목업 80~120 기준).
const MIN = 80
const MAX = 120
const pct = (v: number) => `${(Math.max(0, Math.min(1, (v - MIN) / (MAX - MIN))) * 100).toFixed(1)}%`

export default function MarketOutlook() {
  const { data, isLoading, isError } = useHousePriceOutlook()

  if (isLoading) return <MarketSkeleton />
  if (isError || !data) return <p className="text-sm text-coral">지표를 불러오지 못했습니다.</p>

  const change = data.current.changeFromPrevMonth
  const up = change == null || change >= 0
  const accent = up ? '#3df5c5' : '#5ba8ff'

  return (
    <div className="space-y-3.5">
      <header className="mt-1.5">
        <h1 className="text-[21px] font-extrabold tracking-tight">시장 지수</h1>
        <p className="mt-1 text-[13px] text-muted">
          MVP는 서울 집값 전망 심리를 제공해요 · {data.current.baseMonth}
        </p>
      </header>

      {/* 집값 전망 심리 — 제공 중 (히어로) */}
      <section
        className="rounded-[20px] border border-mint/20 px-[18px] pb-[18px] pt-5"
        style={{ background: 'linear-gradient(135deg,#0c1828,#0a1320)' }}
      >
        <div className="mb-0.5 flex items-center justify-between">
          <span className="text-base font-extrabold whitespace-nowrap">{data.name}</span>
          <span className="rounded-md bg-mint/15 px-2 py-0.5 font-mono text-[10px] text-mint">제공 중</span>
        </div>

        <div className="mt-4 flex items-end justify-between">
          <span className="text-[15px] font-bold" style={{ color: accent }}>
            {data.current.band}
          </span>
          <div className="text-right">
            <div className="font-mono text-[46px] font-bold leading-none">{data.current.value}</div>
            {change != null && (
              <div className="mt-1 font-mono text-xs font-bold" style={{ color: accent }}>
                {up ? '▲' : '▼'} {Math.abs(change)} · 지난달 대비
              </div>
            )}
          </div>
        </div>

        {/* band slider */}
        <div
          className="relative my-[22px] h-2.5 rounded-full"
          style={{ background: 'linear-gradient(90deg,#5ba8ff,#3df5c5,#ff7b88)' }}
        >
          <div className="absolute -bottom-1 -top-1 w-0.5 bg-white/40" style={{ left: pct(100) }} />
          <div
            className="absolute top-1/2 h-[18px] w-[18px] -translate-x-1/2 -translate-y-1/2 rounded-full border-[3px] bg-ink"
            style={{ left: pct(data.current.value), borderColor: '#0c1828', boxShadow: '0 0 0 1px rgba(255,255,255,0.25)' }}
          />
        </div>
        <div className="mb-3.5 flex justify-between text-[11px] text-muted-2">
          <span>하락 전망</span>
          <span>중립 100</span>
          <span>상승 전망</span>
        </div>

        {/* 추이 (라인차트) */}
        <div className="h-44 min-w-0">
          <ResponsiveContainer width="100%" height={176}>
            <LineChart data={data.history} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
              <XAxis dataKey="baseMonth" tick={{ fontSize: 10, fill: '#8a97ab' }} stroke="rgba(255,255,255,0.1)" />
              <YAxis tick={{ fontSize: 10, fill: '#8a97ab' }} stroke="rgba(255,255,255,0.1)" domain={['dataMin - 5', 'dataMax + 5']} />
              <Tooltip
                contentStyle={{ background: '#11192a', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10, fontSize: 12 }}
                labelStyle={{ color: '#8a97ab' }}
              />
              <Line type="monotone" dataKey="value" stroke="#3df5c5" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="mt-2 flex items-center justify-between text-[11px] text-muted-2">
          <span>최근 추이</span>
          <span>출처 · {data.source.name}</span>
        </div>
      </section>

      <SoonIndexCard
        name="집별 시장온도"
        desc="거래량·매매가격지수·청약 경쟁률 등을 묶은 집별 자체 시장온도예요. 산식·데이터 검증을 거쳐 2차에 제공할 예정이에요."
      />
      <SoonIndexCard
        name="전세 온도"
        desc="전세시장 소비심리를 쉽게 보여주는 지표예요. 이용 조건·산식 검증 후 2차에 제공할 예정이에요."
      />

      <div className="flex gap-2 rounded-2xl border border-violet/20 bg-violet/[0.07] px-4 py-3.5">
        <span className="text-[13px] text-violet">ⓘ</span>
        <span className="text-xs leading-relaxed text-ink-2">{data.disclaimer}</span>
      </div>
    </div>
  )
}

function SoonIndexCard({ name, desc }: { name: string; desc: string }) {
  return (
    <section className="rounded-[20px] border border-dashed border-violet/30 bg-soon px-[18px] py-[18px]">
      <div className="flex items-center justify-between">
        <span className="text-base font-extrabold whitespace-nowrap text-ink-2">{name}</span>
        <span className="rounded-md border border-violet/30 bg-violet/15 px-2 py-0.5 font-mono text-[10px] font-bold text-violet">
          개발 예정
        </span>
      </div>
      <p className="mt-3 text-xs leading-relaxed text-muted">{desc}</p>
    </section>
  )
}

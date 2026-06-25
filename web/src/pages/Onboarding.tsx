import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Chip from '../components/Chip'
import { ALERT_LEVELS, DEFAULT_ALERT_LEVEL, INTEREST_TYPES, SEOUL_GU } from '../lib/constants'
import { useSavePreferences } from '../lib/hooks'

const STEP_META = [
  { title: '관심지역을 골라주세요', sub: '선택한 자치구의 청약·공고·실거래를 먼저 보여드려요. (복수 선택)' },
  { title: '지금 상황에 가장\n가까운 건요?', sub: '상황 맞춤 추천은 2차에 추가될 기능이에요. 미리 살펴보고 다음으로 넘어가세요.' },
  { title: '어떤 정보를\n챙겨드릴까요?', sub: '관심 유형을 고르면 그에 맞는 일정을 우선합니다. (복수 선택)' },
  { title: '알림은 어느 정도로\n받으시겠어요?', sub: '중요도와 관심지역 기준으로 알림을 걸러드려요. 언제든 바꿀 수 있어요.' },
]

const SITUATIONS = [
  ['청약 준비 중', '민간·공공 청약 일정과 공고를 챙겨요'],
  ['공공임대 관심', '행복주택·청년안심주택 등 모집을 받아봐요'],
  ['매수 검토 중', '금리·정책·관심지역 흐름을 살펴요'],
  ['전월세 이사 준비 중', '임대차 정책과 전세 정보를 챙겨요'],
  ['부동산 시장 모니터링', '서울 주요 이슈를 가볍게 훑어봐요'],
]

export default function Onboarding() {
  const navigate = useNavigate()
  const save = useSavePreferences()

  const [step, setStep] = useState(0)
  const [regions, setRegions] = useState<string[]>([])
  const [interests, setInterests] = useState<string[]>([])
  const [alertLevel, setAlertLevel] = useState<string>(DEFAULT_ALERT_LEVEL)

  const toggle = (list: string[], set: (v: string[]) => void, value: string) =>
    set(list.includes(value) ? list.filter((v) => v !== value) : [...list, value])

  const AVAILABLE_INTERESTS = INTEREST_TYPES.filter((t) => t.available).map((t) => t.code)
  const allRegionsSelected = regions.length === SEOUL_GU.length
  const allInterestsSelected = AVAILABLE_INTERESTS.every((c) => interests.includes(c))

  // 스텝별 진행 가능 여부: 지역 ≥1, 유형 ≥1 필수 (상황·알림은 자유)
  const canAdvance =
    (step === 0 && regions.length > 0) ||
    step === 1 ||
    (step === 2 && interests.length > 0) ||
    step === 3

  const next = () => {
    if (!canAdvance) return
    if (step < 3) {
      setStep(step + 1)
      return
    }
    save.mutate(
      { alertLevel, interestTypes: interests, watchRegions: regions.map((guName) => ({ guName })) },
      { onSuccess: () => navigate('/', { replace: true }) },
    )
  }

  const meta = STEP_META[step]

  return (
    <div className="mx-auto flex h-full max-w-[430px] flex-col bg-bg">
      {/* header */}
      <div className="flex-none px-[22px] pb-3.5 pt-[calc(env(safe-area-inset-top)_+_8px)]">
        <div className="mb-4 flex items-center gap-2.5">
          {step > 0 && (
            <button
              type="button"
              onClick={() => setStep(step - 1)}
              className="flex h-[30px] w-[30px] items-center justify-center rounded-[9px] bg-surface-2 text-[17px] text-muted"
            >
              ‹
            </button>
          )}
          <span className="font-mono text-xs tracking-[0.08em] text-muted-2">STEP {step + 1} / 4</span>
        </div>
        <div className="h-1 overflow-hidden rounded-full bg-surface-2">
          <div className="h-full rounded-full bg-mint transition-[width] duration-300" style={{ width: `${((step + 1) / 4) * 100}%` }} />
        </div>
      </div>

      {/* body */}
      <div className="flex-1 overflow-y-auto px-[22px] pb-4 pt-2">
        <div className="mb-2 font-mono text-[11px] tracking-[0.12em] text-mint">집별 · 서울 부동산 레이더</div>
        <h1 className="mb-1.5 whitespace-pre-line text-2xl font-extrabold leading-snug tracking-tight">{meta.title}</h1>
        <p className="mb-6 text-sm leading-relaxed text-muted">{meta.sub}</p>

        {step === 0 && (
          <>
            <div className="mb-3 flex items-center justify-between">
              <span className="text-[13px] text-muted">{regions.length}개 선택됨</span>
              <button
                type="button"
                onClick={() => setRegions(allRegionsSelected ? [] : [...SEOUL_GU])}
                className="text-[13px] font-semibold text-mint"
              >
                {allRegionsSelected ? '전체 해제' : '전체 선택'}
              </button>
            </div>
            <div className="flex flex-wrap gap-2.5">
              {SEOUL_GU.map((gu) => (
                <Chip key={gu} selected={regions.includes(gu)} onClick={() => toggle(regions, setRegions, gu)}>
                  {gu}
                </Chip>
              ))}
            </div>
          </>
        )}

        {step === 1 && (
          <>
            <div className="mb-4 flex items-center gap-2.5 rounded-[13px] border border-violet/20 bg-violet/[0.08] px-3.5 py-3">
              <span className="shrink-0 rounded-md border border-violet/30 bg-violet/15 px-2 py-0.5 font-mono text-[10px] font-bold text-violet">개발 예정</span>
              <span className="text-xs leading-snug text-ink-2">상황·페르소나 맞춤 추천은 2차에 추가돼요. 지금은 건너뛰고 다음으로 넘어가도 돼요.</span>
            </div>
            <div className="pointer-events-none flex select-none flex-col gap-2.5 opacity-50 saturate-50">
              {SITUATIONS.map(([name, desc]) => (
                <div key={name} className="flex items-center justify-between rounded-[14px] border border-white/[0.07] bg-surface px-4 py-3.5">
                  <div className="flex flex-col gap-0.5">
                    <span className="text-[15px] font-bold">{name}</span>
                    <span className="text-[13px] text-muted">{desc}</span>
                  </div>
                  <span className="h-[22px] w-[22px] shrink-0 rounded-full border-[1.5px] border-[#3a4456]" />
                </div>
              ))}
            </div>
          </>
        )}

        {step === 2 && (
          <>
            <div className="mb-3 flex items-center justify-between">
              <span className="text-[13px] text-muted">{interests.length}개 선택됨</span>
              <button
                type="button"
                onClick={() => setInterests(allInterestsSelected ? [] : AVAILABLE_INTERESTS)}
                className="text-[13px] font-semibold text-mint"
              >
                {allInterestsSelected ? '전체 해제' : '전체 선택'}
              </button>
            </div>
            <div className="flex flex-wrap gap-2.5">
              {INTEREST_TYPES.map((t) => (
                <Chip key={t.code} selected={interests.includes(t.code)} disabled={!t.available} onClick={() => toggle(interests, setInterests, t.code)}>
                  {t.label}
                  {!t.available && ' (준비중)'}
                </Chip>
              ))}
            </div>
          </>
        )}

        {step === 3 && (
          <div className="flex flex-col gap-2.5">
            {ALERT_LEVELS.map((a) => {
              const on = alertLevel === a.code
              return (
                <button
                  key={a.code}
                  type="button"
                  onClick={() => setAlertLevel(a.code)}
                  className={`flex items-center justify-between gap-3 rounded-[14px] border px-4 py-3.5 text-left ${
                    on ? 'border-mint/45 bg-mint/[0.08]' : 'border-white/[0.07] bg-surface'
                  }`}
                >
                  <span className="flex flex-col gap-0.5">
                    <span className="text-[15px] font-bold">{a.label}</span>
                    <span className="text-[13px] text-muted">{a.desc}</span>
                  </span>
                  <span className={`flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full border-[1.5px] ${on ? 'border-mint' : 'border-[#3a4456]'}`}>
                    {on && <span className="h-[11px] w-[11px] rounded-full bg-mint" />}
                  </span>
                </button>
              )
            })}
          </div>
        )}

        {save.isError && <p className="mt-4 text-sm text-coral">저장에 실패했습니다. 다시 시도해 주세요.</p>}
      </div>

      {/* footer */}
      <div className="flex-none px-[22px] pb-[calc(env(safe-area-inset-bottom)_+_14px)] pt-3.5">
        <button
          type="button"
          onClick={next}
          disabled={!canAdvance || save.isPending}
          className="flex h-[54px] w-full items-center justify-center rounded-[15px] bg-mint text-base font-extrabold text-mint-ink disabled:opacity-40"
          style={{ boxShadow: '0 8px 24px rgba(52,245,197,0.25)' }}
        >
          {save.isPending ? '저장 중…' : step < 3 ? '다음' : '집별 시작하기'}
        </button>
      </div>
    </div>
  )
}

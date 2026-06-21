interface ChipProps {
  selected: boolean
  onClick: () => void
  disabled?: boolean
  children: React.ReactNode
}

export default function Chip({ selected, onClick, disabled, children }: ChipProps) {
  const base = 'rounded-full border px-3.5 py-2 text-sm font-semibold whitespace-nowrap transition-colors'
  const state = disabled
    ? 'cursor-not-allowed border-white/10 bg-surface text-muted-2 opacity-50'
    : selected
      ? 'border-mint/55 bg-mint/15 text-mint'
      : 'border-white/10 bg-surface text-muted'
  return (
    <button type="button" onClick={onClick} disabled={disabled} className={`${base} ${state}`}>
      {children}
    </button>
  )
}

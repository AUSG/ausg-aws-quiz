interface ProgressBarProps {
  /** 현재 진행 값 (1-based) */
  readonly value: number
  readonly max: number
  readonly className?: string
}

export function ProgressBar({ value, max, className = '' }: ProgressBarProps) {
  const safeMax = max > 0 ? max : 1
  const clamped = Math.min(Math.max(value, 0), safeMax)
  const percent = Math.round((clamped / safeMax) * 100)

  return (
    <div
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={safeMax}
      aria-valuenow={clamped}
      aria-label={`총 ${safeMax}문제 중 ${clamped}번째`}
      className={`h-2 w-full overflow-hidden rounded-full bg-asb-border-light ${className}`}
    >
      {/* Progress uses the blue accent. Orange is reserved for the single
          primary CTA so it stays the loudest thing on screen. */}
      <div
        className="h-full rounded-full bg-asb-blue transition-[width] duration-150 ease-out"
        style={{ width: `${percent}%` }}
      />
    </div>
  )
}

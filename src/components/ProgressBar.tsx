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
      className={`h-2.5 w-full overflow-hidden rounded-full bg-aws-navy/15 ${className}`}
    >
      <div
        className="h-full rounded-full bg-aws-orange transition-[width] duration-150 ease-out"
        style={{ width: `${percent}%` }}
      />
    </div>
  )
}

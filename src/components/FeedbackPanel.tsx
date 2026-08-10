interface FeedbackPanelProps {
  /** false여도 컨테이너는 계속 마운트된다(스크린리더 라이브 리전 유지). */
  readonly revealed: boolean
  readonly isCorrect: boolean
  /** 정답 보기의 라벨. choice → 'A'~'D', ox → 'O' | 'X' */
  readonly correctLabel: string
  readonly explanation: string
  readonly service?: string
}

/** 'A'/'O'는 모음으로 끝나서 '예요', 'X'(엑스)는 자음으로 끝나서 '이에요'. */
const VOWEL_ENDING_LABELS: ReadonlySet<string> = new Set(['A', 'B', 'C', 'D', 'O'])

function headlineFor(isCorrect: boolean, correctLabel: string): string {
  if (isCorrect) return '정답이에요! 🎉'
  const suffix = VOWEL_ENDING_LABELS.has(correctLabel) ? '예요' : '이에요'
  return `아쉬워요, 정답은 ${correctLabel}${suffix}`
}

export function FeedbackPanel({
  revealed,
  isCorrect,
  correctLabel,
  explanation,
  service,
}: FeedbackPanelProps) {
  return (
    <div role="status" aria-live="polite" aria-atomic="true">
      {revealed ? (
        <div
          className={`mt-3 rounded-2xl border-2 p-4 ${
            isCorrect ? 'border-emerald-300 bg-emerald-50' : 'border-rose-300 bg-rose-50'
          }`}
        >
          <p
            className={`flex items-center gap-2 text-lg font-black ${
              isCorrect ? 'text-emerald-900' : 'text-rose-900'
            }`}
          >
            {isCorrect ? <CheckIcon /> : <CrossIcon />}
            {headlineFor(isCorrect, correctLabel)}
          </p>
          <p className="mt-1.5 text-base leading-relaxed text-aws-navy">{explanation}</p>
          {service === undefined ? null : (
            <p className="mt-2 inline-flex rounded-lg bg-aws-navy/10 px-2.5 py-1 text-sm font-bold text-aws-navy">
              {service}
            </p>
          )}
        </div>
      ) : null}
    </div>
  )
}

function CheckIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className="h-6 w-6 shrink-0"
      fill="none"
      stroke="currentColor"
      strokeWidth="3.2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="m5 12.5 4.8 4.8L19 7" />
    </svg>
  )
}

function CrossIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className="h-6 w-6 shrink-0"
      fill="none"
      stroke="currentColor"
      strokeWidth="3.2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M6.5 6.5 17.5 17.5M17.5 6.5 6.5 17.5" />
    </svg>
  )
}

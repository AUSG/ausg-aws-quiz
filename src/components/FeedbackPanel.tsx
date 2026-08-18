interface FeedbackPanelProps {
  /** false여도 컨테이너는 계속 마운트된다(스크린리더 라이브 리전 유지). */
  readonly revealed: boolean
  readonly isCorrect: boolean
  /** 정답 보기의 라벨. choice → 'A'~'D', ox → 'O' | 'X' */
  readonly correctLabel: string
  readonly explanation: string
}

/** 'A'/'O'는 모음으로 끝나서 '예요', 'X'(엑스)는 자음으로 끝나서 '이에요'. */
const VOWEL_ENDING_LABELS: ReadonlySet<string> = new Set(['A', 'B', 'C', 'D', 'O'])

/* 레퍼런스 시스템의 콜아웃 관용구(왼쪽 4px 강조 바 + 옅은 배경)를
   정답/오답 쌍에 적용했다. 디자인 시스템에는 성공/실패 의미색이 없어서
   emerald/rose는 원래대로 둔다. */
const TONE = {
  correct: 'border-emerald-200 border-l-emerald-600 bg-emerald-50',
  wrong: 'border-rose-200 border-l-rose-600 bg-rose-50',
} as const

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
}: FeedbackPanelProps) {
  return (
    <div role="status" aria-live="polite" aria-atomic="true">
      {revealed ? (
        <div
          className={`mt-3 rounded-lg border border-l-4 p-4 short:mt-2 short:p-3 ${
            isCorrect ? TONE.correct : TONE.wrong
          }`}
        >
          <p
            className={`flex items-center gap-2 text-lg leading-snug font-extrabold break-keep short:text-base ${
              isCorrect ? 'text-emerald-900' : 'text-rose-900'
            }`}
          >
            {isCorrect ? <CheckIcon /> : <CrossIcon />}
            {headlineFor(isCorrect, correctLabel)}
          </p>
          <p className="mt-1.5 text-base leading-relaxed text-asb-text break-keep short:mt-1 short:text-[0.95rem]">
            {explanation}
          </p>
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

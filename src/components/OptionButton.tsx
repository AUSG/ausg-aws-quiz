/** 공개 전에는 전부 idle. 공개 후 정답=correct, 내가 고른 오답=wrong, 나머지=muted. */
export type OptionState = 'idle' | 'correct' | 'wrong' | 'muted'

interface OptionButtonProps {
  /** choice → 'A'~'D', ox → 'O' | 'X' */
  readonly label: string
  readonly text: string
  readonly state: OptionState
  /** ox 문항은 라벨 배지를 쓰지 않는다 */
  readonly showLabel: boolean
  /** ox 문항용 대형 타일 모드 */
  readonly tile: boolean
  readonly disabled: boolean
  onSelect: () => void
}

const BOX: Record<OptionState, string> = {
  idle: 'border-aws-navy/15 bg-white text-aws-navy hover:border-aws-orange hover:bg-aws-orange/5',
  correct: 'border-emerald-600 bg-emerald-50 text-emerald-900',
  wrong: 'border-rose-600 bg-rose-50 text-rose-900',
  muted: 'border-aws-navy/10 bg-white text-aws-navy opacity-50',
}

const BADGE: Record<OptionState, string> = {
  idle: 'bg-aws-navy/8 text-aws-navy',
  correct: 'bg-emerald-600 text-white',
  wrong: 'bg-rose-600 text-white',
  muted: 'bg-aws-navy/8 text-aws-navy',
}

/** 색만으로 정오를 구분하지 않도록 아이콘을 같이 쓴다(색각이상 대응). */
const SR_TEXT: Record<OptionState, string | null> = {
  idle: null,
  correct: '정답',
  wrong: '내가 고른 오답',
  muted: null,
}

export function OptionButton({
  label,
  text,
  state,
  showLabel,
  tile,
  disabled,
  onSelect,
}: OptionButtonProps) {
  const srText = SR_TEXT[state]

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onSelect}
      className={
        'flex w-full min-h-14 items-center gap-3 rounded-2xl border-2 px-4 py-2.5 text-left' +
        ' transition-[background-color,border-color] duration-150 ease-out sm:min-h-16' +
        (tile ? ' flex-col justify-center gap-1 text-center' : ' flex-1') +
        ` ${BOX[state]}`
      }
    >
      {showLabel ? (
        <span
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-base font-black ${BADGE[state]}`}
          aria-hidden="true"
        >
          {label}
        </span>
      ) : null}

      <span
        className={
          tile ? 'text-4xl leading-none font-black sm:text-5xl' : 'flex-1 text-lg font-bold'
        }
      >
        {text}
      </span>

      {state === 'correct' ? <CheckIcon /> : null}
      {state === 'wrong' ? <CrossIcon /> : null}
      {srText === null ? null : <span className="sr-only">{srText}</span>}
    </button>
  )
}

function CheckIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className="h-7 w-7 shrink-0 text-emerald-600"
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
      className="h-7 w-7 shrink-0 text-rose-600"
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

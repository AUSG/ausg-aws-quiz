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

/* Border is always 2px, like `.asb-btn` in the reference system. Keeping the
   width constant across states means revealing an answer never reflows. */
const BOX: Record<OptionState, string> = {
  idle: 'border-asb-border bg-white text-asb-text hover:border-asb-blue hover:bg-asb-blue/5',
  correct: 'border-emerald-600 bg-emerald-50 text-emerald-900',
  wrong: 'border-rose-600 bg-rose-50 text-rose-900',
  muted: 'border-asb-border-light bg-white text-asb-gray',
}

const BADGE: Record<OptionState, string> = {
  idle: 'bg-asb-callout text-asb-text',
  correct: 'bg-emerald-600 text-white',
  wrong: 'bg-rose-600 text-white',
  muted: 'bg-asb-callout text-asb-gray',
}

/** 색만으로 정오를 구분하지 않도록 아이콘을 같이 쓴다(색각이상 대응). */
const SR_TEXT: Record<OptionState, string | null> = {
  idle: null,
  correct: '정답',
  wrong: '내가 고른 오답',
  muted: null,
}

/* 44px is the accessibility floor for a tap target; it only rises to 56px once
   the viewport is wide enough to afford it. `flex-1` lets a button soak up
   spare height, and it shrinks back down to min-h when height runs out.
   The parent (OptionList) deliberately omits min-h-0, so this floor is carried
   into the group's own box height instead of spilling over its siblings. */
const SIZING = 'min-h-11 sm:min-h-14 short:min-h-11'

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
        `flex w-full ${SIZING} items-center gap-3 rounded-lg border-2 px-3.5 py-2 text-left` +
        ' transition-[background-color,border-color] duration-150 ease-out sm:px-4' +
        (tile ? ' flex-col justify-center gap-1 text-center' : ' flex-1') +
        ` ${BOX[state]}`
      }
    >
      {showLabel ? (
        <span
          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-base font-bold sm:h-9 sm:w-9 ${BADGE[state]}`}
          aria-hidden="true"
        >
          {label}
        </span>
      ) : null}

      <span
        className={
          tile
            ? 'text-3xl leading-none font-extrabold sm:text-5xl'
            : 'flex-1 text-base leading-snug font-bold break-keep sm:text-lg'
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
      className="h-6 w-6 shrink-0 text-emerald-600 sm:h-7 sm:w-7"
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
      className="h-6 w-6 shrink-0 text-rose-600 sm:h-7 sm:w-7"
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

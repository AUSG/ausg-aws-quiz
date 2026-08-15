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

/* 테두리는 항상 2px다. 레퍼런스의 `.asb-btn`과 같다.
   상태가 바뀌어도 두께가 일정해야 정답 공개 때 레이아웃이 밀리지 않는다. */
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

/* 보기의 크기는 `flex-1`이 아니라 높이 '하한'으로 정한다.
 *
 * 남는 높이를 다 먹게 두면 세로 태블릿에서 보기 4개가 각각 370px짜리 판이 되고,
 * 더 나쁘게는 방금 누른 보기와 '왜 틀렸는지'를 설명하는 해설 사이에 그 여백이
 * 끼어든다. 하한으로 잡으면 문제 → 보기 → 해설이 붙어 있고, 남는 공간은
 * 고정된 버튼 아래 카드 맨 밑으로 밀려난다.
 *
 * The floor tracks viewport height rather than width, because height is what
 * actually runs out: 44px (the accessibility minimum) when there is nothing to
 * spare, 56px normally, 80px on a tall tablet. OX questions use two big tiles
 * instead of a list, so they get a much higher floor. */
const SIZING = {
  list: 'min-h-14 short:min-h-11 tall:min-h-20',
  tile: 'min-h-40 short:min-h-32 tall:min-h-64',
} as const

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
        'flex w-full items-center gap-3 rounded-lg border-2 px-3.5 py-2 text-left' +
        ' transition-[background-color,border-color] duration-150 ease-out sm:px-4' +
        ` ${tile ? SIZING.tile : SIZING.list}` +
        (tile ? ' flex-col justify-center gap-1 text-center' : '') +
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

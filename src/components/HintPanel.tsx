import { useId } from 'react'

interface CodexMarkProps {
  readonly className?: string
}

/**
 * Codex 마크. 원본 PNG 대신 인라인 SVG로 그린다.
 *
 * 부스는 네트워크가 끊긴 상태에서도 돌아야 하므로 자산은 적을수록 좋고,
 * 이 마크는 버튼(20px)과 콜아웃 헤더(16px) 두 크기로 쓰이는데 래스터
 * 이미지로는 작은 쪽에서 뭉갠다. FeedbackPanel의 CheckIcon/CrossIcon과
 * 같은 방식이다.
 *
 * 꽃잎은 원을 여러 개 겹쳐 만든다. 그라디언트를 userSpaceOnUse로 두는 게
 * 핵심인데, 기본값(objectBoundingBox)이면 원마다 그라디언트가 따로 그려져
 * 이음매가 드러난다. 좌표계를 공유해야 덩어리 하나로 보인다.
 */
export function CodexMark({ className = '' }: CodexMarkProps) {
  // 한 화면에 두 번 이상 마운트돼도 defs id가 부딪히지 않게 한다.
  const gradientId = useId()

  return (
    <svg viewBox="0 0 100 100" aria-hidden="true" className={className}>
      <defs>
        <linearGradient
          id={gradientId}
          gradientUnits="userSpaceOnUse"
          x1="30"
          y1="10"
          x2="62"
          y2="95"
        >
          <stop offset="0" stopColor="var(--color-codex-violet)" />
          <stop offset="1" stopColor="var(--color-codex-blue)" />
        </linearGradient>
      </defs>

      <g fill={`url(#${gradientId})`}>
        <circle cx="50" cy="53" r="26" />
        <circle cx="50" cy="30" r="20" />
        <circle cx="69" cy="38" r="18" />
        <circle cx="74" cy="57" r="18" />
        <circle cx="64" cy="75" r="18" />
        <circle cx="45" cy="79" r="19" />
        <circle cx="28" cy="68" r="18" />
        <circle cx="24" cy="48" r="18" />
        <circle cx="33" cy="31" r="18" />
      </g>

      {/* 터미널 프롬프트 `>_` */}
      <g
        fill="none"
        stroke="#ffffff"
        strokeWidth="8.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M36 37 47 50 36 63" />
        <path d="M53 63h16" />
      </g>
    </svg>
  )
}

/**
 * idle → loading → shown. 되돌아가는 전이는 없다(문항이 바뀌면 통째로 idle).
 */
export type HintStatus = 'idle' | 'loading' | 'shown'

interface HintCalloutProps {
  readonly hint: string
  readonly status: HintStatus
}

/**
 * 조용한 안내 상자. 피드백 패널과 일부러 다르게 생겼다.
 *
 * 힌트는 포기하려는 사람에게 던지는 밧줄이지 정답이 아니다. 그래서 초록/빨강
 * 같은 판정 색이 아니라 중립적인 `--asb-bg-callout` 회색을 쓴다.
 * 나중에 해설이 들어올 자리를 그대로 쓰기 때문에, 힌트를 펼쳐도
 * 정답 공개 상태가 이미 필요로 하는 높이 이상을 잡아먹지 않는다.
 * (헤더 한 줄이 붙어도 두 줄 — 해설 상태의 제목/본문/서비스 칩 세 줄보다 낮다.)
 */
export function HintCallout({ hint, status }: HintCalloutProps) {
  return (
    <div role="status" aria-live="polite" aria-atomic="true">
      {status === 'shown' ? (
        <div className="mt-3 rounded-lg border border-l-4 border-asb-border-light border-l-codex-blue bg-asb-callout p-3 short:mt-2">
          <p className="flex items-center gap-1.5 text-sm font-extrabold text-codex-blue">
            <CodexMark className="h-4 w-4 shrink-0" />
            Codex
          </p>
          <p className="mt-1 text-base leading-relaxed text-asb-text break-keep short:text-[0.95rem]">
            <span className="sr-only">힌트. </span>
            {hint}
          </p>
        </div>
      ) : null}
    </div>
  )
}

interface HintPromptProps {
  /** 한 번 열면 버튼이 안내 문구로 바뀐다. 되돌리는 토글은 없다. */
  readonly status: HintStatus
  onShow: () => void
}

/** 세 상태 모두 같은 박스 모델을 쓴다. 여기가 흔들리면 손가락 밑에서 버튼이 움직인다. */
const BUTTON_BOX =
  'inline-flex min-h-11 items-center gap-2 rounded-lg border-2 bg-white px-5 text-base font-bold'

/**
 * 정답 공개 전 하단 슬롯. 힌트를 여는 버튼이거나, 준비 중이거나, 이미 열었다면
 * 원래 안내 문구다.
 *
 * 일부러 한 방향이다 — 부스 태블릿에서 두 번째 탭은 낭비이고 오조작 기회다.
 * 그리고 이미 이 높이를 잡아두고 있던 하단 슬롯을 재사용하기 때문에,
 * 가장 빡빡했던 상태에 힌트를 추가하면서도 높이를 하나도 더 쓰지 않는다.
 *
 * 준비 중에도 버튼을 없애지 않고 disabled로 두는 이유는 두 가지다. 박스가 그대로라
 * 레이아웃이 흔들리지 않고, 연타가 들어와도 두 번째 탭이 그냥 먹힌다.
 */
export function HintPrompt({ status, onShow }: HintPromptProps) {
  if (status === 'shown') {
    return (
      <p className="w-full text-center text-base font-bold text-asb-gray">
        답을 고르면 바로 정답을 알려드려요
      </p>
    )
  }

  const loading = status === 'loading'

  return (
    <div className="flex w-full justify-center">
      <button
        type="button"
        onClick={onShow}
        disabled={loading}
        aria-busy={loading}
        className={
          loading
            ? `${BUTTON_BOX} border-codex-blue/40 text-codex-blue/70`
            : `${BUTTON_BOX} border-codex-blue text-codex-blue` +
              ' transition-[background-color] duration-150 ease-out hover:bg-codex-blue/10'
        }
      >
        <CodexMark className={`h-5 w-5 shrink-0 ${loading ? 'animate-pulse' : ''}`} />
        {loading ? (
          <>
            Codex 생각하는 중
            <ThinkingDots />
          </>
        ) : (
          'Codex 힌트 보기'
        )}
      </button>
    </div>
  )
}

/**
 * 세 점이 차례로 튄다. prefers-reduced-motion은 index.css에서 전역으로
 * 애니메이션을 죽이므로 여기서 따로 분기하지 않는다 — 그때는 점 세 개가
 * 가만히 있고, 그래도 '준비 중'이라는 정보는 문구가 이미 전달한다.
 */
function ThinkingDots() {
  return (
    <span aria-hidden="true" className="inline-flex items-end gap-0.5 pb-0.5">
      <span className="h-1 w-1 animate-bounce rounded-full bg-current" />
      <span className="h-1 w-1 animate-bounce rounded-full bg-current [animation-delay:150ms]" />
      <span className="h-1 w-1 animate-bounce rounded-full bg-current [animation-delay:300ms]" />
    </span>
  )
}

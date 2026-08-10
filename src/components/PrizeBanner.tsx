import type { Tier } from '../lib/grade'

interface PrizeBannerProps {
  readonly tier: Tier
  readonly text: string
  readonly className?: string
}

/**
 * 스태프가 2m 밖에서 색만 보고 판단하는 영역이다.
 * 금색/초록 = 상품 지급, 회색 = 지급 없음. 숫자를 읽을 필요가 없어야 한다.
 */
const TONE: Record<Tier, string> = {
  perfect: 'bg-asb-orange text-black border-asb-orange',
  prize: 'bg-emerald-600 text-white border-emerald-600',
  thanks: 'bg-asb-callout text-asb-text border-asb-border',
}

export function PrizeBanner({ tier, text, className = '' }: PrizeBannerProps) {
  return (
    <div
      className={`w-full shrink-0 rounded-xl border-2 px-4 py-6 text-center text-3xl leading-tight font-extrabold break-keep short:py-4 short:text-2xl sm:py-8 sm:text-4xl ${TONE[tier]} ${className}`}
    >
      {text}
    </div>
  )
}

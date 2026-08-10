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
  perfect: 'bg-gradient-to-r from-amber-300 to-aws-orange text-aws-navy border-amber-200',
  prize: 'bg-emerald-600 text-white border-emerald-400',
  thanks: 'bg-slate-200 text-aws-navy border-slate-300',
}

export function PrizeBanner({ tier, text, className = '' }: PrizeBannerProps) {
  return (
    <div
      className={`w-full shrink-0 rounded-2xl border-2 px-4 py-6 text-center text-3xl leading-tight font-black break-keep sm:py-8 sm:text-4xl ${TONE[tier]} ${className}`}
    >
      {text}
    </div>
  )
}

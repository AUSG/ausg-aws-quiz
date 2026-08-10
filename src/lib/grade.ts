export type Tier = 'perfect' | 'prize' | 'thanks'

export interface TierCopy {
  readonly banner: string
  readonly message: string
}

/**
 * 결과 화면의 등급. 스태프가 2m 밖에서 배너 색만 보고
 * 상품을 줄지 말지 판단할 수 있어야 한다.
 */
export function toTier(score: number, total: number, threshold: number): Tier {
  if (total > 0 && score >= total) return 'perfect'
  if (score >= threshold) return 'prize'
  return 'thanks'
}

export const TIER_COPY: Record<Tier, TierCopy> = {
  perfect: {
    banner: '🏆 만점! 특별 상품 받아가세요!',
    message: 'AWS 전문가세요? 대단해요!',
  },
  prize: {
    banner: '🎁 스티커 받아가세요!',
    message: 'AWS 감 좋으신데요? 👏',
  },
  thanks: {
    banner: '🙌 참여해주셔서 감사합니다!',
    message: '한 번 더 도전해보세요!',
  },
}

export function tierCopy(tier: Tier): TierCopy {
  return TIER_COPY[tier]
}

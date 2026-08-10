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

/**
 * 기본 설정(3문제 전부 정답)에서는 perfect 와 thanks 만 등장한다.
 * prize 는 현장에서 ?prize=2 로 커트라인을 낮췄을 때만 쓰인다.
 */
export const TIER_COPY: Record<Tier, TierCopy> = {
  perfect: {
    banner: '🎁 상품 받아가세요!',
    message: '전부 정답이에요. 대단해요! 👏',
  },
  prize: {
    banner: '🎁 상품 받아가세요!',
    message: 'AWS 감 좋으신데요? 👏',
  },
  thanks: {
    banner: '🙌 참여해주셔서 감사합니다!',
    message: '아쉬워요, 한 번 더 도전해보세요!',
  },
}

export function tierCopy(tier: Tier): TierCopy {
  return TIER_COPY[tier]
}

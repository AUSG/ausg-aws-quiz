export type Tier = 'perfect' | 'prize' | 'thanks'

export interface TierCopy {
  readonly banner: string
  readonly message: string
}

/**
 * 결과 화면의 점수 축하 등급. 등급과 관계없이 모든 참가자가 룰렛을 돌린다.
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
    banner: '🎯 룰렛 기회 획득!',
    message: '전부 정답이에요. 굿즈를 뽑아보세요! 👏',
  },
  prize: {
    banner: '🎯 룰렛 기회 획득!',
    message: '커뮤니티를 잘 알고 계시네요. 굿즈를 뽑아보세요! 👏',
  },
  thanks: {
    banner: '🙌 퀴즈 완료!',
    message: '참여해주셔서 감사해요. 이제 굿즈를 뽑아보세요!',
  },
}

export function tierCopy(tier: Tier): TierCopy {
  return TIER_COPY[tier]
}

import { describe, expect, it } from 'vitest'
import { buildDifficultyPlan, readBoothConfig, SESSION } from '../config'
import { toTier, tierCopy } from '../lib/grade'

describe('readBoothConfig', () => {
  it('파라미터가 없으면 기본값을 쓴다', () => {
    expect(readBoothConfig('')).toEqual(SESSION)
  })

  it('?n=3&prize=2 로 현장에서 조절된다', () => {
    const config = readBoothConfig('?n=3&prize=2')
    expect(config.questionCount).toBe(3)
    expect(config.prizeThreshold).toBe(2)
  })

  it('문항 수를 3~10으로 제한한다', () => {
    expect(readBoothConfig('?n=1').questionCount).toBe(3)
    expect(readBoothConfig('?n=99').questionCount).toBe(10)
  })

  it('커트라인이 문항 수를 넘지 못하게 한다', () => {
    expect(readBoothConfig('?n=3&prize=9').prizeThreshold).toBe(3)
    expect(readBoothConfig('?n=3&prize=0').prizeThreshold).toBe(1)
  })

  it('문항 수를 줄이면 기본 커트라인도 함께 내려간다', () => {
    // 기본 커트라인 4인데 문항이 3개면 아무도 상품을 못 받는 사고가 난다
    expect(readBoothConfig('?n=3').prizeThreshold).toBe(3)
  })

  it('숫자가 아닌 값은 무시하고 기본값을 쓴다', () => {
    expect(readBoothConfig('?n=abc').questionCount).toBe(SESSION.questionCount)
  })

  it('?idle=0 으로 자동 리셋을 끌 수 있다', () => {
    expect(readBoothConfig('?idle=0').idleResetMs).toBe(0)
    expect(readBoothConfig('?idle=30').idleResetMs).toBe(30_000)
  })

  it('?kiosk=0 으로 키오스크 모드를 끌 수 있다', () => {
    expect(readBoothConfig('?kiosk=0').kiosk).toBe(false)
    expect(readBoothConfig('?kiosk=1').kiosk).toBe(true)
  })
})

describe('buildDifficultyPlan', () => {
  it('기본 5문항 계획은 1,1,2,2,3', () => {
    expect(buildDifficultyPlan(5)).toEqual([1, 1, 2, 2, 3])
  })

  it('문항 수와 길이가 항상 같다', () => {
    for (let count = 3; count <= 10; count++) {
      expect(buildDifficultyPlan(count)).toHaveLength(count)
    }
  })

  it('항상 오름차순이고 가장 쉬운 문제로 시작한다', () => {
    for (let count = 3; count <= 10; count++) {
      const plan = buildDifficultyPlan(count)
      expect(plan[0]).toBe(1)
      for (let i = 1; i < plan.length; i++) {
        expect(plan[i] ?? 0).toBeGreaterThanOrEqual(plan[i - 1] ?? 0)
      }
    }
  })
})

describe('toTier', () => {
  it('만점은 perfect', () => {
    expect(toTier(5, 5, 4)).toBe('perfect')
  })

  it('커트라인 이상은 prize', () => {
    expect(toTier(4, 5, 4)).toBe('prize')
  })

  it('커트라인 미만은 thanks', () => {
    expect(toTier(3, 5, 4)).toBe('thanks')
    expect(toTier(0, 5, 4)).toBe('thanks')
  })

  it('문항이 0개면 perfect로 새지 않는다', () => {
    expect(toTier(0, 0, 1)).toBe('thanks')
  })

  it('등급마다 스태프가 읽을 배너 문구가 있다', () => {
    for (const tier of ['perfect', 'prize', 'thanks'] as const) {
      expect(tierCopy(tier).banner.length).toBeGreaterThan(0)
      expect(tierCopy(tier).message.length).toBeGreaterThan(0)
    }
  })
})

import type { Difficulty } from './data/types'

export interface BoothConfig {
  /** 한 세션 문항 수 */
  readonly questionCount: number
  /** 이 점수 이상이면 상품 */
  readonly prizeThreshold: number
  /** 무입력 자동 리셋(ms). 0이면 비활성. */
  readonly idleResetMs: number
  /** 키오스크 모드(공용 태블릿) 여부 */
  readonly kiosk: boolean
}

export const SESSION: BoothConfig = {
  questionCount: 5,
  prizeThreshold: 4,
  idleResetMs: 60_000,
  kiosk: true,
} as const

/** 기본 난이도 배치. 쉬운 것부터 올라가서 1번에서 틀리고 포기하는 걸 막는다. */
export const DEFAULT_DIFFICULTY_PLAN: readonly Difficulty[] = [1, 1, 2, 2, 3]

const MIN_COUNT = 3
const MAX_COUNT = 10

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

function readInt(params: URLSearchParams, key: string): number | null {
  const raw = params.get(key)
  if (raw === null) return null
  const parsed = Number.parseInt(raw, 10)
  return Number.isFinite(parsed) ? parsed : null
}

/**
 * 현장 튜닝용. 재배포 없이 `?n=3&prize=2` 로 문항 수와 커트라인을 바꾼다.
 * 대기줄이 생기면 스태프가 URL만 바꾸면 처리량이 두 배가 된다.
 */
export function readBoothConfig(search: string): BoothConfig {
  const params = new URLSearchParams(search)

  const rawCount = readInt(params, 'n')
  const questionCount =
    rawCount === null ? SESSION.questionCount : clamp(rawCount, MIN_COUNT, MAX_COUNT)

  const rawPrize = readInt(params, 'prize')
  const prizeThreshold =
    rawPrize === null
      ? clamp(SESSION.prizeThreshold, 1, questionCount)
      : clamp(rawPrize, 1, questionCount)

  const rawIdle = readInt(params, 'idle')
  const idleResetMs =
    rawIdle === null ? SESSION.idleResetMs : clamp(rawIdle, 0, 600) * 1000

  const kioskParam = params.get('kiosk')
  const kiosk = kioskParam === null ? SESSION.kiosk : kioskParam !== '0'

  return { questionCount, prizeThreshold, idleResetMs, kiosk }
}

/**
 * 문항 수가 5가 아닐 때도 난이도가 오름차순이 되도록 계획을 늘리거나 줄인다.
 */
export function buildDifficultyPlan(count: number): readonly Difficulty[] {
  if (count === DEFAULT_DIFFICULTY_PLAN.length) return DEFAULT_DIFFICULTY_PLAN
  if (count < DEFAULT_DIFFICULTY_PLAN.length) {
    // 앞에서부터 잘라내면 쉬운 것만 남으므로, 1 → 2 → 3 을 고르게 남긴다.
    const step = DEFAULT_DIFFICULTY_PLAN.length / count
    return Array.from({ length: count }, (_, i) => {
      const index = Math.min(
        DEFAULT_DIFFICULTY_PLAN.length - 1,
        Math.round(i * step),
      )
      return DEFAULT_DIFFICULTY_PLAN[index] as Difficulty
    })
  }
  const extra = Array.from<unknown, Difficulty>(
    { length: count - DEFAULT_DIFFICULTY_PLAN.length },
    () => 3,
  )
  return [...DEFAULT_DIFFICULTY_PLAN, ...extra]
}

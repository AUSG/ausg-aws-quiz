import type { Difficulty } from './data/types'
import {
  DEFAULT_QUESTION_COUNT,
  MAX_QUESTION_COUNT,
  MIN_QUESTION_COUNT,
} from './lib/booth-settings'

export interface BoothConfig {
  /** 한 세션 문항 수 */
  readonly questionCount: number
  /** 이 점수 이상이면 결과 화면에서 높은 점수 배너를 표시 */
  readonly prizeThreshold: number
  /** 무입력 자동 리셋(ms). 0이면 비활성. */
  readonly idleResetMs: number
  /** 힌트 버튼을 누르고 힌트가 뜨기까지의 지연(ms). 0이면 즉시. */
  readonly hintDelayMs: number
  /** 키오스크 모드(공용 태블릿) 여부 */
  readonly kiosk: boolean
}

/**
 * 기본 높은 점수 배너는 3문제를 전부 맞혔을 때 표시한다. 이 값은 결과 문구만
 * 바꾸며, 룰렛은 점수와 관계없이 모든 참가자가 이용한다.
 */
export const SESSION: BoothConfig = {
  questionCount: DEFAULT_QUESTION_COUNT,
  prizeThreshold: DEFAULT_QUESTION_COUNT,
  idleResetMs: 60_000,
  hintDelayMs: 700,
  kiosk: true,
} as const

/**
 * 힌트가 즉시 튀어나오면 미리 적어둔 문장을 그대로 꺼내는 것처럼 보인다.
 * 실제로 그렇긴 하지만 화면에 Codex 라벨을 붙여둔 이상 잠깐 뜸을 들이는 편이
 * 앞뒤가 맞는다. 다만 부스는 한 사람당 1분이라 이 지연이 그대로 처리량 비용이다.
 * 대기줄이 길어지면 `?hint=0` 으로 끈다.
 */
const MAX_HINT_DELAY_MS = 3000

/** 기본 난이도 배치. 쉬운 것부터 올라가서 1번에서 틀리고 포기하는 걸 막는다. */
export const DEFAULT_DIFFICULTY_PLAN: readonly Difficulty[] = [1, 1, 2, 2, 3]

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
 * D1에 저장한 문항 수를 기본으로 쓰되, 긴급 현장 튜닝용 `?n=` 값이 있으면
 * URL 값을 우선한다.
 */
export function readBoothConfig(
  search: string,
  persistedQuestionCount = SESSION.questionCount,
): BoothConfig {
  const params = new URLSearchParams(search)

  const rawCount = readInt(params, 'n')
  const questionCount =
    rawCount === null
      ? clamp(persistedQuestionCount, MIN_QUESTION_COUNT, MAX_QUESTION_COUNT)
      : clamp(rawCount, MIN_QUESTION_COUNT, MAX_QUESTION_COUNT)

  const rawPrize = readInt(params, 'prize')
  const prizeThreshold =
    rawPrize === null
      ? questionCount
      : clamp(rawPrize, 1, questionCount)

  const rawIdle = readInt(params, 'idle')
  const idleResetMs =
    rawIdle === null ? SESSION.idleResetMs : clamp(rawIdle, 0, 600) * 1000

  const rawHint = readInt(params, 'hint')
  const hintDelayMs =
    rawHint === null ? SESSION.hintDelayMs : clamp(rawHint, 0, MAX_HINT_DELAY_MS)

  const kioskParam = params.get('kiosk')
  const kiosk = kioskParam === null ? SESSION.kiosk : kioskParam !== '0'

  return { questionCount, prizeThreshold, idleResetMs, hintDelayMs, kiosk }
}

/**
 * 운영자가 고른 3~5개 문항 모두 난이도가 오름차순이 되도록 계획을 줄인다.
 */
export function buildDifficultyPlan(count: number): readonly Difficulty[] {
  if (count === DEFAULT_DIFFICULTY_PLAN.length) return DEFAULT_DIFFICULTY_PLAN
  if (count < DEFAULT_DIFFICULTY_PLAN.length) {
    // 앞에서부터 잘라내면 쉬운 것만 남으므로, 1 → 2 → 3 을 고르게 남긴다.
    const step = (DEFAULT_DIFFICULTY_PLAN.length - 1) / Math.max(1, count - 1)
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

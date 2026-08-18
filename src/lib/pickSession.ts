import { CATEGORIES, type Category, type Difficulty, type Question } from '../data/types'
import { buildDifficultyPlan } from '../config'
import { DEFAULT_QUESTION_COUNT } from './booth-settings'
import { pickOne, shuffle } from './shuffle'

export interface PickOptions {
  readonly count?: number
  /** 테스트에서 시드 rng를 주입하기 위한 훅 */
  readonly rng?: () => number
  readonly difficultyPlan?: readonly Difficulty[]
}

const DEFAULT_COUNT = DEFAULT_QUESTION_COUNT

function byCategory(bank: readonly Question[]): Map<Category, Question[]> {
  const map = new Map<Category, Question[]>()
  for (const category of CATEGORIES) map.set(category, [])
  for (const question of bank) {
    map.get(question.category)?.push(question)
  }
  return map
}

function hasTopicClash(question: Question, usedTopics: ReadonlySet<string>): boolean {
  return (question.topics ?? []).some((topic) => usedTopics.has(topic))
}

/** 후보를 선호도 순으로 좁혀가며 하나 고른다. 절대 throw하지 않는다. */
function selectSlot(
  pools: readonly Question[][],
  wanted: Difficulty,
  usedIds: ReadonlySet<string>,
  usedTopics: ReadonlySet<string>,
  rng: () => number,
): Question | null {
  const fresh = (pool: readonly Question[]) => pool.filter((q) => !usedIds.has(q.id))

  for (const pool of pools) {
    const available = fresh(pool)
    if (available.length === 0) continue

    // 1순위: 계획된 난이도 + 주제 충돌 없음
    const exact = available.filter(
      (q) => q.difficulty === wanted && !hasTopicClash(q, usedTopics),
    )
    if (exact.length > 0) return pickOne(exact, rng)

    // 2순위: 난이도가 가장 가까운 것 + 주제 충돌 없음
    const noClash = available.filter((q) => !hasTopicClash(q, usedTopics))
    if (noClash.length > 0) return pickNearestDifficulty(noClash, wanted, rng)

    // 3순위: 주제가 겹쳐도 난이도라도 맞추기
    return pickNearestDifficulty(available, wanted, rng)
  }
  return null
}

function pickNearestDifficulty(
  pool: readonly Question[],
  wanted: Difficulty,
  rng: () => number,
): Question | null {
  let best = Number.POSITIVE_INFINITY
  for (const question of pool) {
    const distance = Math.abs(question.difficulty - wanted)
    if (distance < best) best = distance
  }
  const nearest = pool.filter((q) => Math.abs(q.difficulty - wanted) === best)
  return pickOne(nearest, rng)
}

/**
 * 카테고리를 분산시키고 난이도를 오름차순으로 배치해 한 세션을 뽑는다.
 *
 * 순수 랜덤을 쓰지 않는 이유: 한 세션에 AUSGCON 문제만 연속으로 나오면
 * 두 커뮤니티의 전체 모습을 보기 어렵다. 카테고리를 분산해 AUSG, AWSKRUG,
 * 공동 활동을 고루 만나게 한다.
 */
export function pickSession(
  bank: readonly Question[],
  options: PickOptions = {},
): readonly Question[] {
  const rng = options.rng ?? Math.random
  const count = options.count ?? DEFAULT_COUNT
  const plan = options.difficultyPlan ?? buildDifficultyPlan(count)

  if (bank.length === 0) return []

  const pools = byCategory(bank)
  const categoryOrder = shuffle(CATEGORIES, rng)
  const usedIds = new Set<string>()
  const usedTopics = new Set<string>()
  const picked: Question[] = []

  for (let slot = 0; slot < count; slot++) {
    const wanted = plan[slot] ?? 3
    const primary = categoryOrder[slot % categoryOrder.length]
    const primaryPool = primary ? (pools.get(primary) ?? []) : []
    // 우선 배정된 카테고리 → 그래도 없으면 은행 전체
    const chosen = selectSlot([primaryPool, bank as Question[]], wanted, usedIds, usedTopics, rng)
    if (!chosen) break

    picked.push(chosen)
    usedIds.add(chosen.id)
    for (const topic of chosen.topics ?? []) usedTopics.add(topic)
  }

  // 난이도 오름차순. 같은 난이도면 뽑힌 순서를 유지한다.
  return picked
    .map((question, index) => ({ question, index }))
    .sort((a, b) =>
      a.question.difficulty === b.question.difficulty
        ? a.index - b.index
        : a.question.difficulty - b.question.difficulty,
    )
    .map((entry) => entry.question)
}

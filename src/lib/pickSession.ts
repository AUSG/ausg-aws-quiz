import { CATEGORIES, type Category, type Difficulty, type Question } from '../data/types'
import { buildDifficultyPlan } from '../config'
import { pickOne, shuffle } from './shuffle'

export interface PickOptions {
  readonly count?: number
  /** 테스트에서 시드 rng를 주입하기 위한 훅 */
  readonly rng?: () => number
  readonly difficultyPlan?: readonly Difficulty[]
  /** 1번 슬롯에 우선 배정할 카테고리. null이면 전부 무작위 순서. */
  readonly leadCategory?: Category | null
}

const DEFAULT_COUNT = 5

/**
 * 첫 문제는 항상 커뮤니티에서 나온다.
 *
 * 부스에서 방금 AUSG·AWSKRUG 소개를 듣고 태블릿을 집은 사람이 첫 문제로
 * 그 이야기를 다시 만나야 소개와 퀴즈가 한 흐름이 된다. 카테고리를 그냥
 * 7개로 늘려두면 3문제 세션에서 커뮤니티가 한 번도 안 나오는 경우가 생긴다.
 *
 * 슬롯 0에 넣는 것만으로 화면에서도 1번이 되는 이유: 난이도 계획의 첫 칸이
 * 항상 1이고, 마지막 정렬이 난이도 오름차순 + 동점이면 뽑힌 순서이기 때문이다.
 */
export const LEAD_CATEGORY: Category = '커뮤니티'

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
 * 리드 카테고리를 맨 앞에 두고 나머지를 섞는다.
 * 리드 카테고리에 문항이 없으면 selectSlot이 은행 전체로 알아서 물러나므로
 * 여기서 은행을 들여다볼 필요가 없다.
 */
function orderCategories(
  lead: Category | null | undefined,
  rng: () => number,
): readonly Category[] {
  const resolved = lead === undefined ? LEAD_CATEGORY : lead
  if (resolved === null) return shuffle(CATEGORIES, rng)
  return [resolved, ...shuffle(CATEGORIES.filter((c) => c !== resolved), rng)]
}

/**
 * 카테고리를 분산시키고 난이도를 오름차순으로 배치해 한 세션을 뽑는다.
 *
 * 순수 랜덤을 쓰지 않는 이유: 초보자가 네트워킹 5문제를 연속으로 받으면
 * 1번에서 틀리고 태블릿을 내려놓는다. 카테고리 분산은 부스 퀴즈를
 * 'AWS 한 바퀴 둘러보기'로 만들어 주기도 한다.
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
  const categoryOrder = orderCategories(options.leadCategory, rng)
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

import { describe, expect, it } from 'vitest'
import { questions } from '../data/questions'
import { CATEGORIES } from '../data/types'
import { pickSession } from '../lib/pickSession'
import { pickOne, shuffle } from '../lib/shuffle'
import { seededRng } from './seededRng'

const SEEDS = Array.from({ length: 200 }, (_, i) => i + 1)

describe('pickSession', () => {
  it('요청한 개수만큼 뽑는다', () => {
    for (const seed of SEEDS) {
      expect(pickSession(questions, { count: 5, rng: seededRng(seed) })).toHaveLength(5)
    }
  })

  it('같은 문항을 두 번 뽑지 않는다', () => {
    for (const seed of SEEDS) {
      const picked = pickSession(questions, { count: 5, rng: seededRng(seed) })
      expect(new Set(picked.map((q) => q.id)).size).toBe(picked.length)
    }
  })

  it('카테고리를 겹치지 않게 분산시킨다', () => {
    for (const seed of SEEDS) {
      const picked = pickSession(questions, { count: 5, rng: seededRng(seed) })
      expect(new Set(picked.map((q) => q.category)).size).toBe(5)
    }
  })

  it('난이도가 오름차순이라 1번 문제가 가장 쉽다', () => {
    for (const seed of SEEDS) {
      const picked = pickSession(questions, { count: 5, rng: seededRng(seed) })
      for (let i = 1; i < picked.length; i++) {
        const prev = picked[i - 1]
        const curr = picked[i]
        expect(curr?.difficulty ?? 0).toBeGreaterThanOrEqual(prev?.difficulty ?? 0)
      }
      expect(picked[0]?.difficulty).toBe(1)
    }
  })

  it('한 세션에 같은 주제가 두 번 나오지 않는다', () => {
    for (const seed of SEEDS) {
      const picked = pickSession(questions, { count: 5, rng: seededRng(seed) })
      const topics = picked.flatMap((q) => q.topics ?? [])
      expect(new Set(topics).size).toBe(topics.length)
    }
  })

  it('기본 문항 수 3개에서도 카테고리와 난이도를 분산한다', () => {
    for (const seed of SEEDS.slice(0, 50)) {
      const picked = pickSession(questions, { count: 3, rng: seededRng(seed) })
      expect(picked).toHaveLength(3)
      expect(new Set(picked.map((q) => q.category)).size).toBe(3)
      expect(picked[0]?.difficulty).toBe(1)
    }
  })

  it('모든 카테고리가 첫 문제로 나올 수 있다', () => {
    const firstCategories = new Set(
      SEEDS.map((seed) => pickSession(questions, { count: 5, rng: seededRng(seed) })[0]?.category),
    )
    expect(firstCategories).toEqual(new Set(CATEGORIES))
  })

  it('전체 문제 은행의 모든 문항이 출제 가능하다', () => {
    const reachable = new Set(
      SEEDS.flatMap((seed) =>
        pickSession(questions, { count: 5, rng: seededRng(seed) }).map((q) => q.id),
      ),
    )
    expect(reachable).toEqual(new Set(questions.map((q) => q.id)))
  })

  it('빈 은행에서는 빈 배열을 준다', () => {
    expect(pickSession([], { count: 5 })).toEqual([])
  })

  it('은행보다 많이 요청해도 throw하지 않는다', () => {
    const tiny = questions.slice(0, 2)
    expect(pickSession(tiny, { count: 5 }).length).toBeLessThanOrEqual(2)
  })

  it('기본 옵션으로도 동작한다', () => {
    expect(pickSession(questions)).toHaveLength(3)
  })

  // 아래 두 개는 "문제 은행이 망가져도 절대 throw하지 않는다"는 보장을 지킨다.
  it('계획된 난이도가 없으면 가장 가까운 난이도로 대체한다', () => {
    const onlyHard = questions.filter((q) => q.difficulty === 3)
    const picked = pickSession(onlyHard, { count: 5, rng: seededRng(11) })
    expect(picked).toHaveLength(5)
    expect(picked.every((q) => q.difficulty === 3)).toBe(true)
  })

  it('주제가 전부 겹쳐도 개수를 채운다', () => {
    const sameTopic = questions
      .slice(0, 8)
      .map((q) => ({ ...q, topics: ['everything'] as readonly string[] }))
    expect(pickSession(sameTopic, { count: 5, rng: seededRng(12) })).toHaveLength(5)
  })

  it('카테고리가 하나뿐이어도 개수를 채운다', () => {
    const oneCategory = questions.filter((q) => q.category === 'AWSKRUG 활동')
    const picked = pickSession(oneCategory, { count: 5, rng: seededRng(13) })
    expect(picked).toHaveLength(5)
    expect(new Set(picked.map((q) => q.id)).size).toBe(5)
  })

  it('시드가 다르면 다른 세트가 나온다', () => {
    const a = pickSession(questions, { count: 5, rng: seededRng(1) })
      .map((q) => q.id)
      .join()
    const b = pickSession(questions, { count: 5, rng: seededRng(99) })
      .map((q) => q.id)
      .join()
    expect(a).not.toBe(b)
  })
})

describe('shuffle', () => {
  it('원본을 변형하지 않는다', () => {
    const original = [1, 2, 3, 4, 5]
    const snapshot = [...original]
    shuffle(original, seededRng(7))
    expect(original).toEqual(snapshot)
  })

  it('같은 원소를 모두 유지한다', () => {
    const result = shuffle([1, 2, 3, 4, 5], seededRng(7))
    expect([...result].sort()).toEqual([1, 2, 3, 4, 5])
  })

  it('빈 배열도 안전하다', () => {
    expect(shuffle([])).toEqual([])
  })
})

describe('pickOne', () => {
  it('빈 배열이면 null', () => {
    expect(pickOne([])).toBeNull()
  })

  it('배열 안의 원소를 돌려준다', () => {
    expect([1, 2, 3]).toContain(pickOne([1, 2, 3], seededRng(3)))
  })
})

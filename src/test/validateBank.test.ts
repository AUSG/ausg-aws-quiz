import { describe, expect, it } from 'vitest'
import { questions } from '../data/questions'
import { validateBank, LIMITS } from '../data/validateBank'
import { CATEGORIES, type Question } from '../data/types'
import { LEAD_CATEGORY } from '../lib/pickSession'

const base: Question = {
  id: 'x-01',
  category: '컴퓨팅',
  difficulty: 1,
  format: 'choice',
  prompt: '테스트 문제인가요?',
  options: ['가', '나', '다', '라'],
  answerIndex: 0,
  explanation: '테스트용 해설입니다.',
  hint: '테스트용 힌트입니다.',
}

describe('실제 문제 은행', () => {
  it('모든 검증 규칙을 통과한다', () => {
    expect(validateBank(questions)).toEqual([])
  })

  it('AWS 카테고리는 6문항씩, 커뮤니티는 8문항이다', () => {
    expect(questions).toHaveLength(44)
    for (const category of CATEGORIES) {
      const expected = category === LEAD_CATEGORY ? 8 : 6
      expect(questions.filter((q) => q.category === category)).toHaveLength(expected)
    }
  })

  it('카테고리마다 난이도 1/2/3이 최소 2문항씩 있다', () => {
    for (const category of CATEGORIES) {
      const pool = questions.filter((q) => q.category === category)
      for (const difficulty of [1, 2, 3] as const) {
        expect(pool.filter((q) => q.difficulty === difficulty).length).toBeGreaterThanOrEqual(2)
      }
    }
  })

  // 리드 카테고리는 매 세션 1번 자리를 고정으로 가져간다. 난이도 1이 얕으면
  // 줄 서서 앞사람 화면을 보던 사람이 같은 첫 문제를 그대로 다시 만난다.
  it('리드 카테고리는 1번 자리를 돌릴 난이도 1 문항이 넉넉하다', () => {
    const lead = questions.filter((q) => q.category === LEAD_CATEGORY && q.difficulty === 1)
    expect(lead.length).toBeGreaterThanOrEqual(4)
  })

  it('O/X 문항이 세션마다 한두 개 나올 만큼 섞여 있다', () => {
    const oxRatio = questions.filter((q) => q.format === 'ox').length / questions.length
    expect(oxRatio).toBeGreaterThan(0.15)
    expect(oxRatio).toBeLessThan(0.5)
  })
})

describe('validateBank', () => {
  it('중복 id를 잡아낸다', () => {
    const errors = validateBank([base, { ...base, prompt: '다른 문제인가요?' }])
    expect(errors.some((e) => e.includes('중복된 id'))).toBe(true)
  })

  it('중복 문장을 잡아낸다', () => {
    const errors = validateBank([base, { ...base, id: 'x-02' }])
    expect(errors.some((e) => e.includes('중복된 문제 문장'))).toBe(true)
  })

  it('choice 문항의 보기가 4개가 아니면 잡아낸다', () => {
    const errors = validateBank([{ ...base, options: ['가', '나', '다'] }])
    expect(errors.some((e) => e.includes('보기가 정확히 4개'))).toBe(true)
  })

  it('ox 문항의 보기가 O/X가 아니면 잡아낸다', () => {
    const errors = validateBank([{ ...base, format: 'ox', options: ['예', '아니오'] }])
    expect(errors.some((e) => e.includes("['O', 'X']"))).toBe(true)
  })

  it('answerIndex가 범위를 벗어나면 잡아낸다', () => {
    const errors = validateBank([{ ...base, answerIndex: 9 }])
    expect(errors.some((e) => e.includes('범위를 벗어남'))).toBe(true)
  })

  it('물음표로 끝나지 않으면 잡아낸다', () => {
    const errors = validateBank([{ ...base, prompt: '물음표가 없다' }])
    expect(errors.some((e) => e.includes('물음표'))).toBe(true)
  })

  it('길이 제한을 넘기면 잡아낸다', () => {
    const errors = validateBank([
      {
        ...base,
        prompt: `${'가'.repeat(LIMITS.prompt + 1)}?`,
        options: ['나'.repeat(LIMITS.option + 1), '나', '다', '라'],
        explanation: '다'.repeat(LIMITS.explanation + 1),
      },
    ])
    expect(errors.some((e) => e.includes('자를 넘음'))).toBe(true)
    expect(errors.some((e) => e.includes('보기가'))).toBe(true)
  })

  it('빈 해설을 잡아낸다', () => {
    const errors = validateBank([{ ...base, explanation: '   ' }])
    expect(errors.some((e) => e.includes('해설이 비어 있음'))).toBe(true)
  })

  it('빈 힌트를 잡아낸다', () => {
    const errors = validateBank([{ ...base, hint: '   ' }])
    expect(errors.some((e) => e.includes('힌트가 비어 있음'))).toBe(true)
  })

  it('너무 긴 힌트를 잡아낸다', () => {
    const errors = validateBank([{ ...base, hint: '가'.repeat(LIMITS.hint + 1) }])
    expect(errors.some((e) => e.includes('힌트가'))).toBe(true)
  })

  // 힌트가 정답을 그대로 말하면 힌트가 아니라 정답 공개다.
  it('힌트에 정답 보기가 그대로 들어가면 잡아낸다', () => {
    const errors = validateBank([{ ...base, hint: '정답은 가 예요' }])
    expect(errors.some((e) => e.includes('그대로 들어 있음'))).toBe(true)
  })

  it('ox 문항은 O/X가 힌트에 있어도 걸리지 않는다', () => {
    const errors = validateBank([
      { ...base, format: 'ox', options: ['O', 'X'], answerIndex: 0, hint: 'OS 패치를 떠올려요' },
    ])
    expect(errors.some((e) => e.includes('그대로 들어 있음'))).toBe(false)
  })

  it('정답 위치가 한쪽에 쏠리면 잡아낸다', () => {
    const skewed = Array.from({ length: 5 }, (_, i) => ({
      ...base,
      id: `x-${i}`,
      prompt: `문제 ${i}번인가요?`,
      answerIndex: 0,
    }))
    expect(validateBank(skewed).some((e) => e.includes('몰려 있음'))).toBe(true)
  })

  it('카테고리에 난이도가 비면 잡아낸다', () => {
    expect(validateBank([base]).some((e) => e.includes('난이도 2 문항이 없음'))).toBe(true)
  })
})

import { CATEGORIES, type Question } from './types'

/**
 * 레이아웃 제약을 콘텐츠 검증으로 위장한 것.
 * 이 길이를 넘으면 667px 높이 뷰포트에서 스크롤이 생기고,
 * 부스에서 스크롤은 곧 이탈이다.
 */
export const LIMITS = {
  prompt: 60,
  option: 24,
  explanation: 70,
  hint: 45,
} as const

const MIN_DIFFICULTY_COVERAGE = 1
/** 정답 위치가 한쪽에 쏠리면 찍어서 맞히는 사람이 생긴다. */
const MAX_ANSWER_INDEX_SHARE = 0.4

export function validateBank(bank: readonly Question[]): string[] {
  const errors: string[] = []
  const seenIds = new Set<string>()
  const seenPrompts = new Set<string>()

  for (const question of bank) {
    const at = `[${question.id}]`

    if (seenIds.has(question.id)) errors.push(`${at} 중복된 id`)
    seenIds.add(question.id)

    const normalizedPrompt = question.prompt.trim()
    if (seenPrompts.has(normalizedPrompt)) errors.push(`${at} 중복된 문제 문장`)
    seenPrompts.add(normalizedPrompt)

    if (question.format === 'choice') {
      if (question.options.length !== 4) {
        errors.push(`${at} choice 문항은 보기가 정확히 4개여야 함 (현재 ${question.options.length})`)
      }
    } else if (question.options.length !== 2 || question.options[0] !== 'O' || question.options[1] !== 'X') {
      errors.push(`${at} ox 문항의 보기는 정확히 ['O', 'X'] 여야 함`)
    }

    if (question.answerIndex < 0 || question.answerIndex >= question.options.length) {
      errors.push(`${at} answerIndex가 보기 범위를 벗어남`)
    }

    if (normalizedPrompt.length > LIMITS.prompt) {
      errors.push(`${at} 문제가 ${LIMITS.prompt}자를 넘음 (${normalizedPrompt.length}자)`)
    }
    if (!normalizedPrompt.endsWith('?')) {
      errors.push(`${at} 문제는 물음표로 끝나야 함`)
    }

    for (const option of question.options) {
      if (option.length > LIMITS.option) {
        errors.push(`${at} 보기가 ${LIMITS.option}자를 넘음: "${option}"`)
      }
    }

    const explanation = question.explanation.trim()
    if (explanation.length === 0) errors.push(`${at} 해설이 비어 있음`)
    if (explanation.length > LIMITS.explanation) {
      errors.push(`${at} 해설이 ${LIMITS.explanation}자를 넘음 (${explanation.length}자)`)
    }

    const hint = question.hint.trim()
    if (hint.length === 0) errors.push(`${at} 힌트가 비어 있음`)
    if (hint.length > LIMITS.hint) {
      errors.push(`${at} 힌트가 ${LIMITS.hint}자를 넘음 (${hint.length}자)`)
    }
    // 힌트가 정답을 그대로 말해버리면 힌트가 아니라 정답 공개다.
    // ox 문항은 정답이 'O'/'X' 한 글자라 우연히 걸리므로 제외한다.
    if (question.format === 'choice') {
      const answerText = question.options[question.answerIndex]
      if (answerText && hint.includes(answerText)) {
        errors.push(`${at} 힌트에 정답 "${answerText}"이(가) 그대로 들어 있음`)
      }
    }
  }

  for (const category of CATEGORIES) {
    const pool = bank.filter((q) => q.category === category)
    if (pool.length === 0) {
      errors.push(`[${category}] 문항이 하나도 없음`)
      continue
    }
    for (const difficulty of [1, 2, 3] as const) {
      const count = pool.filter((q) => q.difficulty === difficulty).length
      if (count < MIN_DIFFICULTY_COVERAGE) {
        errors.push(`[${category}] 난이도 ${difficulty} 문항이 없음`)
      }
    }
  }

  const choiceQuestions = bank.filter((q) => q.format === 'choice')
  if (choiceQuestions.length > 0) {
    for (let index = 0; index < 4; index++) {
      const share =
        choiceQuestions.filter((q) => q.answerIndex === index).length / choiceQuestions.length
      if (share > MAX_ANSWER_INDEX_SHARE) {
        errors.push(
          `정답이 ${index}번 자리에 ${Math.round(share * 100)}% 몰려 있음 (최대 ${MAX_ANSWER_INDEX_SHARE * 100}%)`,
        )
      }
    }
  }

  return errors
}

/** 카테고리 순서는 출제 순서와 무관하다. pickSession이 매 세션 무작위로 섞는다. */
export const CATEGORIES = [
  'AUSG 기본',
  'AUSG 활동',
  'AWSKRUG 기본',
  'AWSKRUG 활동',
  '함께하기',
  'AUSGCON 2026',
] as const

export type Category = (typeof CATEGORIES)[number]

/**
 * 1 = 소개를 들으면 바로 풀 수 있는 기본 사실
 * 2 = 지원 조건·활동 방식·채널을 구분하는 문항
 * 3 = 두 커뮤니티의 관계나 활동 문화를 정확히 이해해야 하는 문항
 */
export type Difficulty = 1 | 2 | 3

export type QuestionFormat = 'choice' | 'ox'

export interface Question {
  /** 카테고리 접두사 + 번호. 예: 'sto-03' */
  readonly id: string
  readonly category: Category
  readonly difficulty: Difficulty
  readonly format: QuestionFormat
  /** 최대 60자. 물음표로 끝낼 것. */
  readonly prompt: string
  /** choice → 정확히 4개 / ox → 정확히 ['O', 'X'] */
  readonly options: readonly string[]
  /** options 배열의 정답 인덱스 */
  readonly answerIndex: number
  /** 한 문장, 최대 70자. 비전공자가 읽어도 이해되게. */
  readonly explanation: string
  /**
   * 힌트. 최대 45자.
   * 정답을 직접 말하지 않고 개념만 상기시킨다 — 답을 몰라 포기하는 사람을
   * 붙잡는 게 목적이지, 정답을 알려주는 게 목적이 아니다.
   * validateBank가 정답 보기 문구가 그대로 들어갔는지 검사한다.
   */
  readonly hint: string
  /** 문항 사실을 검증한 공식 자료. 화면에는 표시하지 않는다. */
  readonly sourceUrl?: string
  /** 한 세션에 같은 주제가 두 번 나오지 않게 하는 키. 예: ['ausg-name'] */
  readonly topics?: readonly string[]
}

export const OX_OPTIONS = ['O', 'X'] as const

/** choice 문항의 보기 라벨. ox 문항은 라벨 없이 O/X 자체를 보여준다. */
export const CHOICE_LABELS = ['A', 'B', 'C', 'D'] as const

export function optionLabel(question: Question, index: number): string {
  if (question.format === 'ox') return question.options[index] ?? ''
  return CHOICE_LABELS[index] ?? ''
}

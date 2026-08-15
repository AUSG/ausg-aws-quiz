/**
 * '커뮤니티'가 맨 앞인 건 우연이 아니다. pickSession이 이걸 리드 카테고리로
 * 삼아 매 세션 1번 문제를 여기서 뽑는다 — 부스에서 방금 AUSG·AWSKRUG를
 * 소개받은 사람이 첫 문제로 그 이야기를 다시 만나야 소개가 퀴즈로 이어진다.
 */
export const CATEGORIES = [
  '커뮤니티',
  '컴퓨팅',
  '스토리지',
  '데이터베이스',
  '네트워킹',
  '보안',
  '요금·운영',
] as const

export type Category = (typeof CATEGORIES)[number]

/**
 * 전체 스케일은 AWS Certified Cloud Practitioner(CLF-C02) 수준이다.
 * 1 = 기본 개념 회상 — 온디맨드, 서버리스, 객체 스토리지 등
 * 2 = 서비스 식별    — 요구사항을 읽고 알맞은 서비스 고르기
 * 3 = 비교·시나리오  — Multi-AZ의 목적, 지원 플랜, stateful 여부 등
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
  /** 결과 화면 복습용 서비스명. 예: 'Amazon S3' */
  readonly service?: string
  /** 한 세션에 같은 주제가 두 번 나오지 않게 하는 키. 예: ['s3', 'object-storage'] */
  readonly topics?: readonly string[]
}

export const OX_OPTIONS = ['O', 'X'] as const

/** choice 문항의 보기 라벨. ox 문항은 라벨 없이 O/X 자체를 보여준다. */
export const CHOICE_LABELS = ['A', 'B', 'C', 'D'] as const

export function optionLabel(question: Question, index: number): string {
  if (question.format === 'ox') return question.options[index] ?? ''
  return CHOICE_LABELS[index] ?? ''
}

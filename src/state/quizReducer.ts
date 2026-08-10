import type { Question } from '../data/types'

export type Phase = 'idle' | 'playing' | 'done'

export interface QuizState {
  readonly phase: Phase
  readonly questions: readonly Question[]
  readonly index: number
  /** 문항별 선택 인덱스. 미응답은 null. */
  readonly answers: readonly (number | null)[]
  /** 현재 문항의 정답 공개 여부 */
  readonly revealed: boolean
  readonly startedAt: number | null
  readonly finishedAt: number | null
}

export type QuizAction =
  | { type: 'START'; questions: readonly Question[]; at: number }
  | { type: 'ANSWER'; optionIndex: number }
  | { type: 'NEXT'; at: number }
  | { type: 'RESET' }

export const initialQuizState: QuizState = {
  phase: 'idle',
  questions: [],
  index: 0,
  answers: [],
  revealed: false,
  startedAt: null,
  finishedAt: null,
}

export function quizReducer(state: QuizState, action: QuizAction): QuizState {
  switch (action.type) {
    case 'START': {
      if (action.questions.length === 0) return state
      return {
        phase: 'playing',
        questions: action.questions,
        index: 0,
        answers: action.questions.map(() => null),
        revealed: false,
        startedAt: action.at,
        finishedAt: null,
      }
    }

    case 'ANSWER': {
      // 공용 태블릿에서 연타가 들어온다. revealed 가드가 그걸 막는다.
      if (state.phase !== 'playing' || state.revealed) return state
      const current = state.questions[state.index]
      if (!current) return state
      if (action.optionIndex < 0 || action.optionIndex >= current.options.length) return state

      return {
        ...state,
        answers: state.answers.map((answer, i) =>
          i === state.index ? action.optionIndex : answer,
        ),
        revealed: true,
      }
    }

    case 'NEXT': {
      if (state.phase !== 'playing' || !state.revealed) return state
      const isLast = state.index >= state.questions.length - 1
      if (isLast) {
        return { ...state, phase: 'done', revealed: false, finishedAt: action.at }
      }
      return { ...state, index: state.index + 1, revealed: false }
    }

    case 'RESET':
      return initialQuizState

    default:
      return state
  }
}

export function selectCurrent(state: QuizState): Question | null {
  return state.questions[state.index] ?? null
}

export function selectScore(state: QuizState): number {
  return state.questions.reduce(
    (score, question, i) => (state.answers[i] === question.answerIndex ? score + 1 : score),
    0,
  )
}

export function selectIsLast(state: QuizState): boolean {
  return state.questions.length > 0 && state.index >= state.questions.length - 1
}

export function selectSelected(state: QuizState): number | null {
  return state.answers[state.index] ?? null
}

export function selectIsCorrect(state: QuizState): boolean {
  const current = selectCurrent(state)
  if (!current) return false
  return state.answers[state.index] === current.answerIndex
}

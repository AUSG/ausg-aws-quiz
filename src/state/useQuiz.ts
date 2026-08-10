import { useCallback, useMemo, useReducer } from 'react'
import type { Question } from '../data/types'
import { pickSession } from '../lib/pickSession'
import {
  initialQuizState,
  quizReducer,
  selectCurrent,
  selectIsCorrect,
  selectIsLast,
  selectScore,
  selectSelected,
  type Phase,
} from './quizReducer'

export interface QuizResultItem {
  readonly question: Question
  readonly selected: number | null
  readonly isCorrect: boolean
}

export interface UseQuiz {
  readonly phase: Phase
  readonly question: Question | null
  /** 0-based */
  readonly index: number
  readonly total: number
  readonly selected: number | null
  readonly revealed: boolean
  /** revealed일 때만 의미 있음 */
  readonly isCorrect: boolean
  readonly isLast: boolean
  readonly score: number
  readonly results: readonly QuizResultItem[]
  readonly elapsedMs: number
  start: () => void
  answer: (optionIndex: number) => void
  next: () => void
  reset: () => void
}

export interface UseQuizOptions {
  readonly count?: number
  readonly rng?: () => number
  readonly now?: () => number
}

/**
 * 랜덤은 여기서만 일어난다. 뽑힌 배열을 START 액션에 실어 보내므로
 * 리듀서는 순수하게 유지되고 테스트가 결정적이 된다.
 */
export function useQuiz(bank: readonly Question[], options: UseQuizOptions = {}): UseQuiz {
  const [state, dispatch] = useReducer(quizReducer, initialQuizState)
  const { count, rng, now } = options
  const clock = now ?? (() => Date.now())

  const start = useCallback(() => {
    const questions = pickSession(bank, { count, rng })
    dispatch({ type: 'START', questions, at: clock() })
    // clock은 매 렌더 새 함수지만 dispatch 시점에만 호출되므로 의존성에서 제외한다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bank, count, rng])

  const answer = useCallback((optionIndex: number) => {
    dispatch({ type: 'ANSWER', optionIndex })
  }, [])

  const next = useCallback(() => {
    dispatch({ type: 'NEXT', at: clock() })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const reset = useCallback(() => {
    dispatch({ type: 'RESET' })
  }, [])

  const results = useMemo<readonly QuizResultItem[]>(
    () =>
      state.questions.map((question, i) => {
        const selected = state.answers[i] ?? null
        return { question, selected, isCorrect: selected === question.answerIndex }
      }),
    [state.questions, state.answers],
  )

  const elapsedMs =
    state.startedAt === null ? 0 : (state.finishedAt ?? state.startedAt) - state.startedAt

  return {
    phase: state.phase,
    question: selectCurrent(state),
    index: state.index,
    total: state.questions.length,
    selected: selectSelected(state),
    revealed: state.revealed,
    isCorrect: selectIsCorrect(state),
    isLast: selectIsLast(state),
    score: selectScore(state),
    results,
    elapsedMs,
    start,
    answer,
    next,
    reset,
  }
}

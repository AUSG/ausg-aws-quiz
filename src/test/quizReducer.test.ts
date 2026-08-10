import { describe, expect, it } from 'vitest'
import {
  initialQuizState,
  quizReducer,
  selectCurrent,
  selectIsCorrect,
  selectIsLast,
  selectScore,
  selectSelected,
  type QuizState,
} from '../state/quizReducer'
import type { Question } from '../data/types'

function makeQuestion(id: string, answerIndex = 0): Question {
  return {
    id,
    category: '컴퓨팅',
    difficulty: 1,
    format: 'choice',
    prompt: `${id} 문제인가요?`,
    options: ['가', '나', '다', '라'],
    answerIndex,
    explanation: '해설',
  }
}

const three = [makeQuestion('a', 0), makeQuestion('b', 1), makeQuestion('c', 2)]

function started(questions = three): QuizState {
  return quizReducer(initialQuizState, { type: 'START', questions, at: 1000 })
}

describe('START', () => {
  it('첫 문항부터 시작하고 답안을 비운다', () => {
    const state = started()
    expect(state.phase).toBe('playing')
    expect(state.index).toBe(0)
    expect(state.answers).toEqual([null, null, null])
    expect(state.revealed).toBe(false)
    expect(state.startedAt).toBe(1000)
  })

  it('빈 문항 목록이면 상태를 바꾸지 않는다', () => {
    expect(quizReducer(initialQuizState, { type: 'START', questions: [], at: 1 })).toBe(
      initialQuizState,
    )
  })
})

describe('ANSWER', () => {
  it('선택을 기록하고 정답을 공개한다', () => {
    const state = quizReducer(started(), { type: 'ANSWER', optionIndex: 2 })
    expect(state.answers[0]).toBe(2)
    expect(state.revealed).toBe(true)
  })

  it('이미 공개된 뒤의 연타는 무시한다', () => {
    const first = quizReducer(started(), { type: 'ANSWER', optionIndex: 2 })
    const second = quizReducer(first, { type: 'ANSWER', optionIndex: 3 })
    expect(second).toBe(first)
    expect(second.answers[0]).toBe(2)
  })

  it('playing이 아니면 무시한다', () => {
    expect(quizReducer(initialQuizState, { type: 'ANSWER', optionIndex: 0 })).toBe(
      initialQuizState,
    )
  })

  it('보기 범위를 벗어난 인덱스는 무시한다', () => {
    const state = started()
    expect(quizReducer(state, { type: 'ANSWER', optionIndex: 9 })).toBe(state)
    expect(quizReducer(state, { type: 'ANSWER', optionIndex: -1 })).toBe(state)
  })

  it('원본 answers 배열을 변형하지 않는다', () => {
    const before = started()
    const snapshot = [...before.answers]
    quizReducer(before, { type: 'ANSWER', optionIndex: 1 })
    expect(before.answers).toEqual(snapshot)
  })
})

describe('NEXT', () => {
  it('공개 전에는 넘어가지 않는다', () => {
    const state = started()
    expect(quizReducer(state, { type: 'NEXT', at: 2000 })).toBe(state)
  })

  it('공개 후 다음 문항으로 넘어가며 공개 상태를 되돌린다', () => {
    const answered = quizReducer(started(), { type: 'ANSWER', optionIndex: 0 })
    const next = quizReducer(answered, { type: 'NEXT', at: 2000 })
    expect(next.index).toBe(1)
    expect(next.revealed).toBe(false)
    expect(next.phase).toBe('playing')
  })

  it('마지막 문항에서는 done으로 끝낸다', () => {
    let state = started()
    for (let i = 0; i < three.length; i++) {
      state = quizReducer(state, { type: 'ANSWER', optionIndex: 0 })
      state = quizReducer(state, { type: 'NEXT', at: 3000 })
    }
    expect(state.phase).toBe('done')
    expect(state.finishedAt).toBe(3000)
  })
})

describe('RESET', () => {
  it('초기 상태로 되돌린다', () => {
    const answered = quizReducer(started(), { type: 'ANSWER', optionIndex: 0 })
    expect(quizReducer(answered, { type: 'RESET' })).toEqual(initialQuizState)
  })
})

describe('셀렉터', () => {
  it('맞힌 개수를 센다', () => {
    let state = started()
    state = quizReducer(state, { type: 'ANSWER', optionIndex: 0 }) // 정답
    state = quizReducer(state, { type: 'NEXT', at: 1 })
    state = quizReducer(state, { type: 'ANSWER', optionIndex: 3 }) // 오답
    state = quizReducer(state, { type: 'NEXT', at: 2 })
    state = quizReducer(state, { type: 'ANSWER', optionIndex: 2 }) // 정답
    expect(selectScore(state)).toBe(2)
  })

  it('현재 문항과 선택을 돌려준다', () => {
    const state = quizReducer(started(), { type: 'ANSWER', optionIndex: 1 })
    expect(selectCurrent(state)?.id).toBe('a')
    expect(selectSelected(state)).toBe(1)
    expect(selectIsCorrect(state)).toBe(false)
  })

  it('마지막 문항 여부를 판단한다', () => {
    expect(selectIsLast(started())).toBe(false)
    expect(selectIsLast(started([makeQuestion('solo')]))).toBe(true)
    expect(selectIsLast(initialQuizState)).toBe(false)
  })

  it('문항이 없으면 안전한 기본값을 준다', () => {
    expect(selectCurrent(initialQuizState)).toBeNull()
    expect(selectIsCorrect(initialQuizState)).toBe(false)
    expect(selectScore(initialQuizState)).toBe(0)
  })
})

import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { AnswerRecap } from '../components/AnswerRecap'
import type { QuizResultItem } from '../state/useQuiz'
import type { Question } from '../data/types'

afterEach(cleanup)

const oxQuestion: Question = {
  id: 'ox-1',
  category: 'AUSG 기본',
  difficulty: 1,
  format: 'ox',
  prompt: 'AUSG는 대학생 커뮤니티인가요?',
  options: ['O', 'X'],
  answerIndex: 0,
  explanation: '대학생이 함께 배우고 경험을 나누는 커뮤니티예요.',
  hint: '이름의 마지막 두 단어를 떠올려요.',
}

const choiceQuestion: Question = {
  id: 'ch-1',
  category: 'AWSKRUG 기본',
  difficulty: 1,
  format: 'choice',
  prompt: 'AWSKRUG 마스코트의 이름은?',
  options: ['구름이', '바람이', '별이', '눈송이'],
  answerIndex: 0,
  explanation: '클라우드를 형상화한 구름이예요.',
  hint: '하늘에 떠 있는 모습을 생각해요.',
}

function item(question: Question, selected: number | null): QuizResultItem {
  return { question, selected, isCorrect: selected === question.answerIndex }
}

describe('AnswerRecap', () => {
  it('접혀 있으면 점만 보여준다', () => {
    render(<AnswerRecap results={[item(oxQuestion, 0)]} expanded={false} />)
    expect(screen.queryByText(oxQuestion.prompt)).not.toBeInTheDocument()
    expect(screen.getByLabelText('문항별 결과')).toBeInTheDocument()
  })

  it('O/X 문항은 "정답 O. O"처럼 중복 표기하지 않는다', () => {
    render(<AnswerRecap results={[item(oxQuestion, 1)]} expanded />)
    expect(screen.getByText('정답 O')).toBeInTheDocument()
    expect(screen.getByText('내 답 X')).toBeInTheDocument()
    expect(screen.queryByText(/정답 O\. O/)).not.toBeInTheDocument()
  })

  it('객관식은 보기 라벨을 함께 보여준다', () => {
    render(<AnswerRecap results={[item(choiceQuestion, 1)]} expanded />)
    expect(screen.getByText('정답 A. 구름이')).toBeInTheDocument()
    expect(screen.getByText('내 답 B. 바람이')).toBeInTheDocument()
  })

  it('맞힌 문항은 내 답을 따로 보여주지 않는다', () => {
    render(<AnswerRecap results={[item(choiceQuestion, 0)]} expanded />)
    expect(screen.getByText('정답 A. 구름이')).toBeInTheDocument()
    expect(screen.queryByText(/내 답/)).not.toBeInTheDocument()
  })

  it('무응답도 안전하게 표시한다', () => {
    render(<AnswerRecap results={[item(choiceQuestion, null)]} expanded />)
    expect(screen.getByText('내 답 없음 (무응답)')).toBeInTheDocument()
  })
})

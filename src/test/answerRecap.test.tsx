import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { AnswerRecap } from '../components/AnswerRecap'
import type { QuizResultItem } from '../state/useQuiz'
import type { Question } from '../data/types'

afterEach(cleanup)

const oxQuestion: Question = {
  id: 'ox-1',
  category: '컴퓨팅',
  difficulty: 1,
  format: 'ox',
  prompt: '클라우드는 빌려 쓰는 것인가요?',
  options: ['O', 'X'],
  answerIndex: 0,
  explanation: '필요할 때 빌려 쓰는 방식이에요.',
}

const choiceQuestion: Question = {
  id: 'ch-1',
  category: '보안',
  difficulty: 1,
  format: 'choice',
  prompt: '한 단계를 더 확인하는 것은?',
  options: ['다중 인증(MFA)', '백업', '암호화', '로그인'],
  answerIndex: 0,
  explanation: '한 번 더 확인해 계정을 지켜요.',
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
    expect(screen.getByText('정답 A. 다중 인증(MFA)')).toBeInTheDocument()
    expect(screen.getByText('내 답 B. 백업')).toBeInTheDocument()
  })

  it('맞힌 문항은 내 답을 따로 보여주지 않는다', () => {
    render(<AnswerRecap results={[item(choiceQuestion, 0)]} expanded />)
    expect(screen.getByText('정답 A. 다중 인증(MFA)')).toBeInTheDocument()
    expect(screen.queryByText(/내 답/)).not.toBeInTheDocument()
  })

  it('무응답도 안전하게 표시한다', () => {
    render(<AnswerRecap results={[item(choiceQuestion, null)]} expanded />)
    expect(screen.getByText('내 답 없음 (무응답)')).toBeInTheDocument()
  })
})

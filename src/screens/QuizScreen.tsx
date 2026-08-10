import type { Question } from '../data/types'
import { optionLabel } from '../data/types'
import { Card } from '../components/Card'
import { CategoryChip } from '../components/CategoryChip'
import { FeedbackPanel } from '../components/FeedbackPanel'
import { OptionList } from '../components/OptionList'
import { PrimaryButton } from '../components/PrimaryButton'
import { ProgressBar } from '../components/ProgressBar'

interface QuizScreenProps {
  readonly question: Question
  /** 0-based */
  readonly index: number
  readonly total: number
  readonly selected: number | null
  readonly revealed: boolean
  readonly isLast: boolean
  onAnswer: (optionIndex: number) => void
  onNext: () => void
}

/**
 * 한 문항이 화면을 꽉 채우고 스크롤되지 않는다.
 * 보기 버튼은 flex-1로 남는 공간을 먹었다가 피드백이 열리면 min-h-14까지 줄어든다.
 */
export function QuizScreen({
  question,
  index,
  total,
  selected,
  revealed,
  isLast,
  onAnswer,
  onNext,
}: QuizScreenProps) {
  const isCorrect = selected === question.answerIndex

  return (
    <Card className="h-full max-h-full">
      <header className="shrink-0">
        <div className="flex items-center justify-between gap-3">
          <p className="text-base font-black text-aws-navy/70">
            <span className="text-aws-navy">{index + 1}</span> / {total}
          </p>
          <CategoryChip category={question.category} />
        </div>
        <ProgressBar className="mt-2" value={index + 1} max={total} />
      </header>

      <div className="mt-4 flex min-h-0 flex-1 flex-col overflow-y-auto">
        <h1 className="shrink-0 text-xl leading-snug font-black text-aws-navy break-keep sm:text-2xl">
          {question.prompt}
        </h1>

        <div className="mt-4 flex min-h-0 flex-1 flex-col">
          <OptionList
            question={question}
            selected={selected}
            revealed={revealed}
            onSelect={onAnswer}
          />
        </div>

        <FeedbackPanel
          revealed={revealed}
          isCorrect={isCorrect}
          correctLabel={optionLabel(question, question.answerIndex)}
          explanation={question.explanation}
          service={question.service}
        />
      </div>

      {/* 보기 영역과 색·위치가 확실히 다른 자리. 공개 전에도 높이를 잡아둬서
          버튼이 갑자기 손가락 밑에 나타나는 일이 없게 한다. */}
      <div className="mt-4 flex min-h-14 shrink-0 items-center sm:min-h-16">
        {revealed ? (
          <PrimaryButton onClick={onNext}>{isLast ? '결과 보기' : '다음 문제'}</PrimaryButton>
        ) : (
          <p className="w-full text-center text-base font-bold text-aws-navy/60">
            답을 고르면 바로 정답을 알려드려요
          </p>
        )}
      </div>
    </Card>
  )
}

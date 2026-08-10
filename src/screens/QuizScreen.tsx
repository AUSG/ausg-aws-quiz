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
 *
 * 세로 구조는 세 덩어리로 고정한다.
 *   header(고정) / 본문(유일한 스크롤 영역) / 다음 버튼(고정)
 * 다음 버튼을 스크롤 영역 밖에 두어야 "정답 보고 다음 누르기"가
 * 항상 한 번의 탭으로 끝난다. 본문 안에서는 보기 그룹이 flex-1 로
 * 남는 공간을 먹되, min-h-0 없이 자식의 최소 높이를 그대로 유지한다.
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
          <p className="text-base font-bold text-asb-gray">
            <span className="font-extrabold text-asb-text">{index + 1}</span> / {total}
          </p>
          <CategoryChip category={question.category} />
        </div>
        <ProgressBar className="mt-2" value={index + 1} max={total} />
      </header>

      <div className="mt-4 flex min-h-0 flex-1 flex-col overflow-y-auto short:mt-3">
        <h1 className="shrink-0 text-xl leading-snug font-extrabold text-asb-dark break-keep short:text-lg sm:text-2xl">
          {question.prompt}
        </h1>

        <div className="mt-4 flex flex-1 flex-col short:mt-3">
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
      <div className="mt-4 flex min-h-14 shrink-0 items-center short:mt-3 short:min-h-12 sm:min-h-16">
        {revealed ? (
          <PrimaryButton onClick={onNext}>{isLast ? '결과 보기' : '다음 문제'}</PrimaryButton>
        ) : (
          <p className="w-full text-center text-base font-bold text-asb-gray">
            답을 고르면 바로 정답을 알려드려요
          </p>
        )}
      </div>
    </Card>
  )
}

import type { Question } from '../data/types'
import { optionLabel } from '../data/types'
import { OptionButton } from './OptionButton'
import type { OptionState } from './OptionButton'

interface OptionListProps {
  readonly question: Question
  readonly selected: number | null
  readonly revealed: boolean
  onSelect: (optionIndex: number) => void
}

function toState(
  index: number,
  answerIndex: number,
  selected: number | null,
  revealed: boolean,
): OptionState {
  if (!revealed) return 'idle'
  // 틀려도 정답은 항상 초록으로 보여준다. 시험이 아니라 알려주는 화면이다.
  if (index === answerIndex) return 'correct'
  if (index === selected) return 'wrong'
  return 'muted'
}

export function OptionList({ question, selected, revealed, onSelect }: OptionListProps) {
  const isOx = question.format === 'ox'

  return (
    <div
      role="group"
      aria-label="보기"
      className={
        isOx
          ? 'grid min-h-0 flex-1 grid-cols-2 gap-3'
          : 'flex min-h-0 flex-1 flex-col gap-2.5'
      }
    >
      {question.options.map((text, index) => (
        <OptionButton
          key={`${question.id}-${index}`}
          label={optionLabel(question, index)}
          text={text}
          tile={isOx}
          showLabel={!isOx}
          disabled={revealed}
          state={toState(index, question.answerIndex, selected, revealed)}
          onSelect={() => onSelect(index)}
        />
      ))}
    </div>
  )
}

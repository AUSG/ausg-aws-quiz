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

/**
 * 여기에 `flex-1` / `min-h-0` 이 **없는 것**이 레이아웃 버그 수정의 핵심이다.
 *
 * OptionButton은 각자 min-height(탭 타깃)를 갖고 있어 그 아래로는 줄지 않는다.
 * 이 그룹이 `flex-1 min-h-0` 이었을 때는 그룹의 '박스'만 그 하한 아래로 줄고
 * 버튼들은 높이를 유지한 채 박스 밖으로 그려져, 옆에 있는 피드백 패널 위를
 * 그대로 덮어버렸다. 내용 크기대로 두면 그룹이 항상 자식을 감싸므로,
 * 높이가 모자라도 부모 스크롤이 될 뿐 겹침은 발생할 수 없다.
 */
export function OptionList({ question, selected, revealed, onSelect }: OptionListProps) {
  const isOx = question.format === 'ox'

  return (
    <div
      role="group"
      aria-label="보기"
      className={isOx ? 'grid grid-cols-2 gap-3' : 'flex flex-col gap-2.5 short:gap-2'}
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

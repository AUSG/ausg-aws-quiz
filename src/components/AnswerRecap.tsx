import type { QuizResultItem } from '../state/useQuiz'
import { optionLabel } from '../data/types'

interface AnswerRecapProps {
  readonly results: readonly QuizResultItem[]
  /** 펼치면 문항별 정답/내 답/해설을 인라인으로 보여준다 */
  readonly expanded: boolean
  readonly id?: string
  readonly className?: string
}

export function AnswerRecap({ results, expanded, id, className = '' }: AnswerRecapProps) {
  return (
    <div id={id} className={className}>
      <ul className="flex flex-wrap items-center justify-center gap-2.5" aria-label="문항별 결과">
        {results.map((item, index) => (
          <li key={item.question.id} className="flex items-center">
            <span
              aria-hidden="true"
              className={`block h-4 w-4 rounded-full ${
                item.isCorrect ? 'bg-emerald-600' : 'bg-white ring-2 ring-asb-gray-light'
              }`}
            />
            <span className="sr-only">{`${index + 1}번 ${item.isCorrect ? '정답' : '오답'}`}</span>
          </li>
        ))}
      </ul>

      {expanded ? (
        <ol className="mt-5 flex flex-col gap-3 text-left">
          {results.map((item, index) => (
            <RecapItem key={item.question.id} item={item} number={index + 1} />
          ))}
        </ol>
      ) : null}
    </div>
  )
}

interface RecapItemProps {
  readonly item: QuizResultItem
  readonly number: number
}

/** ox 문항은 라벨과 보기 텍스트가 같으므로 "정답 O. O"처럼 중복 표기하지 않는다. */
function describeOption(question: RecapItemProps['item']['question'], index: number): string {
  const text = question.options[index] ?? ''
  if (question.format === 'ox') return text
  return `${optionLabel(question, index)}. ${text}`
}

function RecapItem({ item, number }: RecapItemProps) {
  const { question, selected, isCorrect } = item
  const answerDescription = describeOption(question, question.answerIndex)
  const pickedDescription = selected === null ? null : describeOption(question, selected)

  return (
    <li
      className={`rounded-lg border border-l-4 p-4 ${
        isCorrect
          ? 'border-emerald-200 border-l-emerald-600 bg-emerald-50'
          : /* White, not the callout grey: the meta line is 14px bold
               asb-gray, which lands at 4.29:1 on #eef2f6 and 5.0:1 on white.
               The left bar and the border still separate it from a correct
               answer. */
            'border-asb-border-light border-l-asb-gray-light bg-white'
      }`}
    >
      <p className="text-sm font-bold text-asb-gray">
        {number}번 · {question.category} · {isCorrect ? '정답' : '오답'}
      </p>
      <p className="mt-1 text-base leading-snug font-bold text-asb-dark break-keep">
        {question.prompt}
      </p>

      <p className="mt-2.5 text-base font-bold text-emerald-800">정답 {answerDescription}</p>

      {!isCorrect ? (
        <p className="mt-1 text-base font-bold text-rose-700">
          {pickedDescription === null ? '내 답 없음 (무응답)' : `내 답 ${pickedDescription}`}
        </p>
      ) : null}

      <p className="mt-2 text-[0.95rem] leading-relaxed text-asb-text break-keep">
        {question.explanation}
      </p>
    </li>
  )
}

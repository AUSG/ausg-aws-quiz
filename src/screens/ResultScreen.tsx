import { useState } from 'react'
import type { QuizResultItem } from '../state/useQuiz'
import { toTier, tierCopy } from '../lib/grade'
import { AnswerRecap } from '../components/AnswerRecap'
import { Card } from '../components/Card'
import { PrimaryButton } from '../components/PrimaryButton'
import { PrizeBanner } from '../components/PrizeBanner'

interface ResultScreenProps {
  readonly score: number
  readonly total: number
  readonly results: readonly QuizResultItem[]
  readonly prizeThreshold: number
  onRestart: () => void
}

const RECAP_ID = 'answer-recap'

/** 스태프용 화면. 배너가 가장 크고, 색만으로 상품 지급 여부가 읽혀야 한다. */
export function ResultScreen({
  score,
  total,
  results,
  prizeThreshold,
  onRestart,
}: ResultScreenProps) {
  const [expanded, setExpanded] = useState(false)
  const tier = toTier(score, total, prizeThreshold)
  const copy = tierCopy(tier)

  return (
    <Card className="h-full max-h-full">
      {/* 배너까지 한 덩어리로 세로 가운데 정렬해야 배너와 점수 사이가 벌어지지 않는다.
          펼치면 위에서부터 스크롤된다. */}
      <div
        className={`flex min-h-0 flex-1 flex-col overflow-y-auto ${
          expanded ? '' : 'justify-center'
        }`}
      >
        <PrizeBanner tier={tier} text={copy.banner} />

        {/* 배너보다 작게 유지한다 — 스태프가 먼저 읽어야 하는 건 배너다. */}
        <h1 className="mt-6 shrink-0 text-center text-3xl leading-tight font-black text-aws-navy break-keep">
          {total}문제 중 {score}문제 정답!
        </h1>
        <p className="mt-2 shrink-0 text-center text-lg font-bold text-aws-navy/80 break-keep">
          {copy.message}
        </p>

        <AnswerRecap id={RECAP_ID} className="mt-5" results={results} expanded={expanded} />
      </div>

      <div className="mt-5 flex shrink-0 flex-col gap-2.5">
        <PrimaryButton onClick={onRestart}>다시 풀기</PrimaryButton>
        <PrimaryButton
          variant="secondary"
          ariaExpanded={expanded}
          ariaControls={RECAP_ID}
          onClick={() => setExpanded((previous) => !previous)}
        >
          {expanded ? '정답 접기' : '정답 다시 보기'}
        </PrimaryButton>
      </div>
    </Card>
  )
}

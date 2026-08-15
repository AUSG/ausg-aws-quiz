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
    // 접힌 상태에서는 카드가 내용만큼만 차지하고 App이 가운데 정렬한다.
    // 시작 화면과 같은 방식이다 — 3문항 복습은 폰 화면을 채우지 못하고,
    // 억지로 늘리면 배너 위에 큰 공백이 생긴다. 펼치는 건 명시적인 탭이고,
    // 그때 비로소 카드가 전체 높이를 차지해 문항별 복습을 내부 스크롤한다.
    <Card className={expanded ? 'h-full max-h-full' : 'max-h-full'}>
      {/* 배너까지 한 덩어리로 세로 가운데 정렬해야 배너와 점수 사이가 벌어지지 않는다.
          펼치면 위에서부터 스크롤된다. */}
      <div
        className={`flex min-h-0 flex-col overflow-y-auto ${
          expanded ? 'flex-1' : 'shrink'
        }`}
      >
        <PrizeBanner tier={tier} text={copy.banner} />

        {/* 배너보다 작게 유지한다 — 스태프가 먼저 읽어야 하는 건 배너다. */}
        <h1 className="mt-6 shrink-0 text-center text-3xl leading-tight font-extrabold text-asb-dark break-keep short:mt-4 short:text-2xl">
          {total}문제 중 {score}문제 정답!
        </h1>
        <p className="mt-2 shrink-0 text-center text-lg font-bold text-asb-gray break-keep">
          {copy.message}
        </p>

        <AnswerRecap id={RECAP_ID} className="mt-5" results={results} expanded={expanded} />
      </div>

      <div className="mt-5 flex shrink-0 flex-col gap-2.5 short:mt-4">
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

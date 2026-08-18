import { Card } from '../components/Card'
import { CodexMark } from '../components/HintPanel'
import { PrimaryButton } from '../components/PrimaryButton'

interface StartScreenProps {
  readonly total: number
  onStart: () => void
}

/**
 * 지나가는 사람이 행사 맥락과 참여 보상을 한눈에 읽는 첫 화면이다.
 * 행사명과 제작 안내는 카드 밖의 상단·하단에 두고, 카드에는 퀴즈 참여 정보만 남긴다.
 */
export function StartScreen({ total, onStart }: StartScreenProps) {
  return (
    <div className="flex h-full min-h-0 w-full flex-col items-center py-2 short:py-1 sm:py-3">
      <div className="inline-flex max-w-full items-center gap-2 rounded-full border border-codex-blue/25 bg-codex-blue/5 px-3 py-2 text-left text-sm leading-tight font-bold text-codex-blue short:py-1.5">
        <CodexMark className="h-6 w-6 shrink-0" />
        <span>
          Codex Community Hackathon
          <span className="block font-normal">Seoul for Students</span>
        </span>
      </div>

      <div className="flex min-h-0 w-full flex-1 items-center py-4 short:py-2 sm:py-6">
        <Card className="items-center py-8 text-center short:py-5 sm:py-11">
          <h1 className="text-4xl leading-tight font-extrabold text-asb-dark break-keep short:text-3xl sm:text-[2.65rem] sm:whitespace-nowrap">
            AUSG × AWSKRUG 퀴즈
          </h1>

          <span aria-hidden="true" className="mt-5 block h-1 w-16 rounded-full bg-asb-blue" />

          <div className="mt-5 space-y-1">
            <p className="text-xl font-bold text-asb-gray short:text-lg">
              {total <= 3 ? `${total}문제, 30초면 끝나요` : `${total}문제, 1분이면 끝나요`}
            </p>
            <p className="text-base font-bold text-asb-dark break-keep short:text-sm">
              퀴즈를 풀고 굿즈 룰렛을 돌려보세요!
            </p>
          </div>

          <PrimaryButton className="mt-8 short:mt-5" onClick={onStart}>
            시작하기
          </PrimaryButton>
        </Card>
      </div>

      <p className="shrink-0 text-sm text-codex-blue">이 퀴즈는 Codex로 만들었어요.</p>
    </div>
  )
}

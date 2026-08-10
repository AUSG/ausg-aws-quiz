import { Card } from '../components/Card'
import { PrimaryButton } from '../components/PrimaryButton'

interface StartScreenProps {
  readonly total: number
  onStart: () => void
}

/** 지나가면서도 읽혀야 하는 화면. 제목·소요시간·시작 버튼만 남긴다. */
export function StartScreen({ total, onStart }: StartScreenProps) {
  return (
    <Card className="items-center text-center">
      <h1 className="text-4xl leading-tight font-black text-aws-navy sm:text-5xl">
        AWS 상식 퀴즈
      </h1>

      <p className="mt-4 text-xl font-bold text-aws-navy/85">{total}문제, 1분이면 끝나요</p>
      <p className="mt-1.5 text-lg text-aws-navy/75 break-keep">
        찍어도 괜찮아요, 정답은 바로 알려드려요
      </p>

      <PrimaryButton className="mt-8" onClick={onStart}>
        시작하기
      </PrimaryButton>
    </Card>
  )
}

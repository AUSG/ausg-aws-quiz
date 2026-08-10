import { Card } from '../components/Card'
import { PrimaryButton } from '../components/PrimaryButton'

interface StartScreenProps {
  readonly total: number
  onStart: () => void
}

/**
 * Has to be readable by someone walking past. Three elements only:
 * title, duration, start button.
 *
 * With so few elements the spacing *is* the design. Generous top/bottom
 * padding, the title and the duration line kept close together as one block,
 * and a single large gap before the button — so it reads as "things to read"
 * then "the thing to press" rather than three loose items. The short blue rule
 * is the one piece of decoration, borrowed from the reference system's active
 * tab underline, and it stops the title from floating inside the card.
 */
export function StartScreen({ total, onStart }: StartScreenProps) {
  return (
    <Card className="items-center py-10 text-center short:py-6 sm:py-14">
      <h1 className="text-4xl leading-tight font-extrabold text-asb-dark short:text-3xl sm:text-5xl">
        AWS 상식 퀴즈
      </h1>

      <span aria-hidden="true" className="mt-5 block h-1 w-16 rounded-full bg-asb-blue" />

      {/* The particle differs between the two nouns, so this cannot be one
          template with the duration swapped in. */}
      <p className="mt-5 text-xl font-bold text-asb-gray short:text-lg">
        {total <= 3 ? `${total}문제, 30초면 끝나요` : `${total}문제, 1분이면 끝나요`}
      </p>

      <PrimaryButton className="mt-10 short:mt-7" onClick={onStart}>
        시작하기
      </PrimaryButton>
    </Card>
  )
}

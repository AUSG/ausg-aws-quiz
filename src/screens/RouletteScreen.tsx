import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Card } from '../components/Card'
import { PrimaryButton } from '../components/PrimaryButton'
import {
  isPrizeCatalogResponse,
  isSpinResponse,
  type PrizeDisplayItem,
  type SpinRequest,
  type SpinResponse,
} from '../lib/prizes'

interface RouletteScreenProps {
  readonly request: SpinRequest
  onDone: () => void
}

type RoulettePhase = 'loading' | 'ready' | 'requesting' | 'spinning' | 'won' | 'load-error'

const SPIN_TURNS = 6
const SPIN_DURATION_MS = 4000
const MIN_WHEEL_SEGMENTS = 12
const MIN_REPEATS_PER_PRIZE = 3

export function RouletteScreen({ request, onDone }: RouletteScreenProps) {
  const [phase, setPhase] = useState<RoulettePhase>('loading')
  const [catalog, setCatalog] = useState<readonly PrizeDisplayItem[]>([])
  const [result, setResult] = useState<SpinResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [rotation, setRotation] = useState(0)
  const fallbackTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const wheelPrizes = useMemo(() => repeatWheelPrizes(catalog), [catalog])

  const loadCatalog = useCallback(async (signal?: AbortSignal) => {
    setPhase('loading')
    setError(null)
    try {
      const response = await fetch('/api/prizes', {
        headers: { Accept: 'application/json' },
        signal,
      })
      const body: unknown = await response.json()
      if (!response.ok || !isPrizeCatalogResponse(body)) throw new Error(readApiError(body))
      if (body.prizes.length === 0) throw new Error('등록된 굿즈가 없어요.')

      // 소진 여부와 관계없이 등록된 모든 상품을 룰렛 그림에 남긴다. 실제 당첨
      // 가능 여부는 서버가 판단하며, 공개 응답에는 재고 숫자 자체가 없다.
      setCatalog(body.prizes)
      setPhase('ready')
    } catch (caught) {
      if (caught instanceof DOMException && caught.name === 'AbortError') return
      setError(caught instanceof Error ? caught.message : '굿즈를 불러오지 못했어요.')
      setPhase('load-error')
    }
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    void loadCatalog(controller.signal)
    return () => controller.abort()
  }, [loadCatalog])

  useEffect(
    () => () => {
      if (fallbackTimer.current !== null) clearTimeout(fallbackTimer.current)
    },
    [],
  )

  const finishSpin = useCallback(() => {
    if (fallbackTimer.current !== null) {
      clearTimeout(fallbackTimer.current)
      fallbackTimer.current = null
    }
    setPhase((current) => (current === 'spinning' ? 'won' : current))
  }, [])

  const spin = useCallback(async () => {
    if (phase !== 'ready' || wheelPrizes.length === 0) return

    setPhase('requesting')
    setError(null)
    try {
      const response = await fetch('/api/spin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(request),
      })
      const body: unknown = await response.json()
      if (!response.ok || !isSpinResponse(body)) throw new Error(readApiError(body))

      const nextWheelPrizes = repeatWheelPrizes(body.prizes)
      const winningIndexes = nextWheelPrizes.flatMap((prize, index) =>
        prize.code === body.prize.code ? [index] : [],
      )
      if (winningIndexes.length === 0) {
        throw new Error('룰렛 결과를 표시할 수 없어요. 다시 눌러주세요.')
      }
      const winningIndex = secureArrayItem(winningIndexes)
      const segmentAngle = 360 / nextWheelPrizes.length
      const winningCenter = (winningIndex + 0.5) * segmentAngle
      const landingAngle = SPIN_TURNS * 360 + ((360 - winningCenter) % 360)

      setCatalog(body.prizes)
      setResult(body)
      setPhase('spinning')

      // 새 목록과 transition 시작값이 먼저 한 프레임 그려져야 실제 회전이 보인다.
      requestAnimationFrame(() => requestAnimationFrame(() => setRotation(landingAngle)))
      fallbackTimer.current = setTimeout(finishSpin, SPIN_DURATION_MS + 250)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '당첨 결과를 정하지 못했어요.')
      setPhase('ready')
    }
  }, [finishSpin, phase, request, wheelPrizes])

  const wheelBackground = useMemo(() => makeWheelBackground(wheelPrizes), [wheelPrizes])
  const busy = phase === 'requesting' || phase === 'spinning'

  return (
    <Card className="max-h-full items-center overflow-y-auto text-center">
      <p className="text-sm font-extrabold tracking-wide text-codex-blue">AUSG × AWSKRUG GOODS</p>
      <h1 className="mt-1 text-3xl leading-tight font-extrabold text-asb-dark short:text-2xl">
        굿즈 룰렛
      </h1>

      {phase === 'loading' ? (
        <div role="status" className="flex flex-1 items-center py-12 text-lg font-bold text-asb-gray">
          룰렛을 준비하고 있어요…
        </div>
      ) : null}

      {phase === 'load-error' ? (
        <div className="flex flex-1 flex-col justify-center py-8">
          <p role="alert" className="font-bold text-red-700 break-keep">{error}</p>
          <PrimaryButton className="mt-6" onClick={() => void loadCatalog()}>
            다시 불러오기
          </PrimaryButton>
        </div>
      ) : null}

      {phase !== 'loading' && phase !== 'load-error' ? (
        <>
          <div className="relative mt-5 aspect-square w-full max-w-[24rem] shrink-0 short:mt-3 short:max-w-[17rem] sm:max-w-[28rem] short:sm:max-w-[22rem]">
            <div
              aria-hidden="true"
              className="absolute top-[-0.35rem] left-1/2 z-10 -translate-x-1/2 border-x-[0.9rem] border-t-[1.65rem] border-x-transparent border-t-asb-dark drop-shadow-sm"
            />
            <div
              role="img"
              aria-label={`룰렛 상품: ${catalog.map((prize) => prize.label).join(', ')}`}
              onTransitionEnd={(event) => {
                if (event.target === event.currentTarget) finishSpin()
              }}
              className="h-full w-full rounded-full border-[0.55rem] border-white shadow-[0_3px_16px_rgba(0,0,0,0.22)] motion-safe:transition-transform motion-safe:ease-[cubic-bezier(0.12,0.62,0.08,1)]"
              style={{
                background: wheelBackground,
                transform: `rotate(${rotation}deg)`,
                transitionDuration: `${SPIN_DURATION_MS}ms`,
              }}
            >
              {wheelPrizes.map((prize, index) => {
                const angle = ((index + 0.5) * 360) / wheelPrizes.length
                return (
                  <span
                    key={`${prize.code}-${index}`}
                    aria-hidden="true"
                    className="pointer-events-none absolute inset-2 flex justify-center"
                    style={{ transform: `rotate(${angle}deg)` }}
                  >
                    <span
                      className="mt-3 h-fit max-w-28 truncate rounded-full bg-white/95 px-2.5 py-1.5 text-sm font-extrabold text-asb-dark shadow-sm short:mt-2 short:px-2 short:py-1 short:text-xs"
                      style={{
                        transform: `rotate(${-angle - (phase === 'won' ? rotation % 360 : 0)}deg)`,
                      }}
                    >
                      {prize.label}
                    </span>
                  </span>
                )
              })}
            </div>
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <div className="flex h-24 w-24 items-center justify-center rounded-full border-4 border-white bg-asb-dark text-xl font-extrabold text-white shadow-lg short:h-20 short:w-20 short:text-lg">
                {phase === 'won' ? '당첨!' : busy ? '두근두근' : 'START'}
              </div>
            </div>
          </div>

          {phase === 'won' && result !== null ? (
            <div role="status" aria-live="polite" className="mt-4 w-full rounded-xl border-2 border-asb-orange bg-orange-50 px-4 py-4 short:mt-3 short:py-3">
              <p className="text-lg font-bold text-asb-gray">축하해요!</p>
              <p className="text-3xl font-extrabold text-asb-dark short:text-2xl">
                {result.prize.label} 당첨
              </p>
            </div>
          ) : null}

          {error !== null && phase === 'ready' ? (
            <p role="alert" className="mt-3 text-sm font-bold text-red-700 break-keep">{error}</p>
          ) : null}

          <div className="mt-5 w-full short:mt-3">
            {phase === 'won' ? (
              <PrimaryButton onClick={onDone}>다음 참가자</PrimaryButton>
            ) : (
              <PrimaryButton disabled={busy} onClick={() => void spin()}>
                {phase === 'requesting'
                  ? '당첨 결과 정하는 중…'
                  : phase === 'spinning'
                    ? '룰렛 도는 중…'
                    : error === null
                      ? '룰렛 돌리기'
                      : '다시 돌리기'}
              </PrimaryButton>
            )}
          </div>
        </>
      ) : null}
    </Card>
  )
}

function repeatWheelPrizes(prizes: readonly PrizeDisplayItem[]): readonly PrizeDisplayItem[] {
  if (prizes.length === 0) return []
  const repeats = Math.max(MIN_REPEATS_PER_PRIZE, Math.ceil(MIN_WHEEL_SEGMENTS / prizes.length))
  return Array.from({ length: repeats }, () => prizes).flat()
}

function makeWheelBackground(prizes: readonly PrizeDisplayItem[]): string {
  if (prizes.length === 0) return '#e5e7eb'
  if (prizes.length === 1) return prizes[0]?.color ?? '#e5e7eb'

  const segment = 100 / prizes.length
  const stops = prizes.flatMap((prize, index) => {
    const start = (index * segment).toFixed(3)
    const end = ((index + 1) * segment).toFixed(3)
    return `${prize.color} ${start}% ${end}%`
  })
  return `conic-gradient(from 0deg, ${stops.join(', ')})`
}

function secureArrayItem(items: readonly number[]): number {
  if (items.length === 0) throw new Error('EMPTY_RANDOM_SELECTION')
  if (items.length === 1) {
    const only = items[0]
    if (only === undefined) throw new Error('EMPTY_RANDOM_SELECTION')
    return only
  }
  const range = 2 ** 32
  const ceiling = Math.floor(range / items.length) * items.length
  const random = new Uint32Array(1)
  do crypto.getRandomValues(random)
  while ((random[0] ?? range) >= ceiling)
  const selected = items[(random[0] ?? 0) % items.length]
  if (selected === undefined) throw new Error('EMPTY_RANDOM_SELECTION')
  return selected
}

function readApiError(value: unknown): string {
  if (
    typeof value === 'object' &&
    value !== null &&
    'error' in value &&
    typeof value.error === 'string'
  ) {
    return value.error
  }
  return '서버와 연결하지 못했어요. 잠시 후 다시 시도해주세요.'
}

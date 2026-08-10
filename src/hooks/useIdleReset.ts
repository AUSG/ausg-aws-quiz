import { useEffect, useRef } from 'react'

/**
 * 공용 태블릿 위생. 방문자가 결과 화면을 띄워둔 채 떠나면
 * 다음 사람이 남의 점수를 보게 된다. 카운트다운은 일부러 노출하지 않는다
 * (읽는 중인 방문자를 압박하므로).
 */
export function useIdleReset(enabled: boolean, ms: number, onIdle: () => void): void {
  const onIdleRef = useRef(onIdle)
  onIdleRef.current = onIdle

  useEffect(() => {
    if (!enabled || ms <= 0) return

    let timer = window.setTimeout(() => onIdleRef.current(), ms)

    const restart = () => {
      window.clearTimeout(timer)
      timer = window.setTimeout(() => onIdleRef.current(), ms)
    }

    const events: readonly (keyof WindowEventMap)[] = ['pointerdown', 'keydown', 'touchstart']
    for (const event of events) window.addEventListener(event, restart, { passive: true })

    return () => {
      window.clearTimeout(timer)
      for (const event of events) window.removeEventListener(event, restart)
    }
  }, [enabled, ms])
}

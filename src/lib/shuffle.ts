/**
 * Fisher-Yates. 원본을 건드리지 않고 새 배열을 돌려준다.
 * rng를 주입할 수 있어 테스트에서 결정적으로 검증 가능하다.
 */
export function shuffle<T>(items: readonly T[], rng: () => number = Math.random): T[] {
  const result = [...items]
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    const a = result[i] as T
    const b = result[j] as T
    result[i] = b
    result[j] = a
  }
  return result
}

/** 비어 있으면 null. rng 주입 가능. */
export function pickOne<T>(items: readonly T[], rng: () => number = Math.random): T | null {
  if (items.length === 0) return null
  return items[Math.floor(rng() * items.length)] ?? null
}

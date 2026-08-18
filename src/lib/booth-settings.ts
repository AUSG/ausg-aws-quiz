export const MIN_QUESTION_COUNT = 3
export const MAX_QUESTION_COUNT = 5
export const DEFAULT_QUESTION_COUNT = 3

export interface BoothSettingsResponse {
  readonly questionCount: number
}

export function isBoothSettingsResponse(value: unknown): value is BoothSettingsResponse {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false
  const questionCount = (value as Record<string, unknown>).questionCount
  return (
    typeof questionCount === 'number' &&
    Number.isInteger(questionCount) &&
    questionCount >= MIN_QUESTION_COUNT &&
    questionCount <= MAX_QUESTION_COUNT
  )
}

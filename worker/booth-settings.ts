import {
  MAX_QUESTION_COUNT,
  MIN_QUESTION_COUNT,
  type BoothSettingsResponse,
} from '../src/lib/booth-settings'

interface BoothSettingsRow {
  readonly question_count: number
}

export async function getBoothSettings(db: D1Database): Promise<BoothSettingsResponse> {
  const row = await db
    .prepare('SELECT question_count FROM booth_settings WHERE id = 1')
    .first<BoothSettingsRow>()

  if (!row) throw new Error('BOOTH_SETTINGS_MISSING')
  assertQuestionCount(row.question_count)
  return { questionCount: row.question_count }
}

export async function setQuestionCount(
  db: D1Database,
  questionCount: number,
): Promise<BoothSettingsResponse> {
  assertQuestionCount(questionCount)
  const result = await db
    .prepare(
      `UPDATE booth_settings
       SET question_count = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = 1`,
    )
    .bind(questionCount)
    .run()
  if (!result.success || result.meta.changes !== 1) throw new Error('BOOTH_SETTINGS_MISSING')
  return { questionCount }
}

function assertQuestionCount(value: number): void {
  if (
    !Number.isInteger(value) ||
    value < MIN_QUESTION_COUNT ||
    value > MAX_QUESTION_COUNT
  ) {
    throw new Error('INVALID_QUESTION_COUNT')
  }
}

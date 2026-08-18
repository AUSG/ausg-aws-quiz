import {
  isPrizeCode,
  MAX_PRIZE_WEIGHT,
  MIN_PRIZE_WEIGHT,
  type PrizeCode,
} from '../src/lib/prizes'

export const MAX_PRIZE_QUANTITY = 999
export const MAX_PRIZE_LABEL_LENGTH = 30

const HEX_COLOR_PATTERN = /^#[0-9a-f]{6}$/i

export interface CreatePrizeInput {
  readonly label: string
  readonly quantity: number
  readonly color: string
}

interface QuantityRow {
  readonly unlimited: number
  readonly remaining: number | null
}

export async function createPrize(
  db: D1Database,
  input: CreatePrizeInput,
): Promise<void> {
  const label = input.label.trim()
  if (label.length === 0 || label.length > MAX_PRIZE_LABEL_LENGTH) {
    throw new Error('INVALID_PRIZE_LABEL')
  }
  if (!HEX_COLOR_PATTERN.test(input.color)) throw new Error('INVALID_PRIZE_COLOR')
  assertQuantity(input.quantity)

  const code = `custom-${crypto.randomUUID()}`
  await db.batch([
    db
      .prepare(
        `INSERT INTO prize_inventory (code, label, color, unlimited, sort_order)
         SELECT ?, ?, ?, 0, COALESCE(MAX(sort_order), -1) + 1
         FROM prize_inventory`,
      )
      .bind(code, label, input.color.toLowerCase()),
    db
      .prepare(
        `WITH RECURSIVE slots(stock_slot) AS (
           SELECT 1
           UNION ALL
           SELECT stock_slot + 1 FROM slots WHERE stock_slot < ?
         )
         INSERT INTO prize_stock_units (prize_code, stock_slot)
         SELECT ?, stock_slot FROM slots WHERE stock_slot <= ?`,
      )
      .bind(input.quantity, code, input.quantity),
  ])
}

export async function setPrizeRemaining(
  db: D1Database,
  code: PrizeCode,
  targetRemaining: number,
): Promise<void> {
  if (!isPrizeCode(code)) throw new Error('INVALID_PRIZE_CODE')
  assertQuantity(targetRemaining)

  // 스핀 요청과 동시에 바뀌어도 최종 수량이 사용자가 입력한 값에 수렴하도록
  // 매번 최신 잔여 수량을 다시 읽고 차이만 조정한다. 당첨된 슬롯은 절대 지우지 않는다.
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const current = await readQuantity(db, code)
    if (!current) throw new Error('PRIZE_NOT_FOUND')
    if (current.unlimited === 1) throw new Error('UNLIMITED_PRIZE_QUANTITY')
    if (current.remaining === null) throw new Error('INVALID_STORED_REMAINING')
    if (current.remaining === targetRemaining) return

    try {
      if (current.remaining < targetRemaining) {
        await addStockUnits(db, code, targetRemaining - current.remaining)
      } else {
        await removeUnclaimedStockUnits(db, code, current.remaining - targetRemaining)
      }
    } catch (error) {
      // 읽은 뒤 스핀이 슬롯을 가져가거나 다른 관리자 요청이 슬롯을 바꾸면,
      // 해당 쓰기가 일부만 반영되었을 수 있다. 최신 집계에서 다시 수렴시킨다.
      if (error instanceof Error && error.message === 'INVENTORY_UPDATE_CONFLICT') {
        continue
      }
      throw error
    }
  }

  throw new Error('INVENTORY_UPDATE_RETRY_EXHAUSTED')
}

export async function setPrizeDistribution(
  db: D1Database,
  code: PrizeCode,
  enabled: boolean,
  weight: number,
): Promise<void> {
  if (!isPrizeCode(code)) throw new Error('INVALID_PRIZE_CODE')
  if (
    !Number.isInteger(weight) ||
    weight < MIN_PRIZE_WEIGHT ||
    weight > MAX_PRIZE_WEIGHT
  ) {
    throw new Error('INVALID_PRIZE_WEIGHT')
  }

  const result = await db
    .prepare('UPDATE prize_inventory SET enabled = ?, weight = ? WHERE code = ?')
    .bind(enabled ? 1 : 0, weight, code)
    .run()
  if (!result.success) throw new Error('PRIZE_DISTRIBUTION_UPDATE_FAILED')
  if (result.meta.changes !== 1) throw new Error('PRIZE_NOT_FOUND')
}

async function readQuantity(db: D1Database, code: PrizeCode): Promise<QuantityRow | null> {
  return db
    .prepare('SELECT unlimited, remaining FROM prize_inventory_status WHERE code = ?')
    .bind(code)
    .first<QuantityRow>()
}

async function addStockUnits(db: D1Database, code: PrizeCode, amount: number): Promise<void> {
  const result = await db
    .prepare(
      `WITH RECURSIVE offsets(value) AS (
         SELECT 1
         UNION ALL
         SELECT value + 1 FROM offsets WHERE value < ?
       ),
       base(max_slot) AS (
         SELECT COALESCE(MAX(stock_slot), 0)
         FROM prize_stock_units
         WHERE prize_code = ?
       )
       INSERT INTO prize_stock_units (prize_code, stock_slot)
       SELECT ?, base.max_slot + offsets.value
       FROM base, offsets
       WHERE offsets.value <= ?
       RETURNING stock_slot`,
    )
    .bind(amount, code, code, amount)
    .all<{ stock_slot: number }>()
  if (!result.success || result.results.length !== amount) {
    throw new Error('INVENTORY_UPDATE_CONFLICT')
  }
}

async function removeUnclaimedStockUnits(
  db: D1Database,
  code: PrizeCode,
  amount: number,
): Promise<void> {
  const result = await db
    .prepare(
      `DELETE FROM prize_stock_units
       WHERE prize_code = ?
         AND claimed = 0
         AND stock_slot IN (
           SELECT stock_slot
           FROM prize_stock_units
           WHERE prize_code = ? AND claimed = 0
           ORDER BY stock_slot DESC
           LIMIT ?
         )
       RETURNING stock_slot`,
    )
    .bind(code, code, amount)
    .all<{ stock_slot: number }>()
  if (!result.success || result.results.length !== amount) {
    throw new Error('INVENTORY_UPDATE_CONFLICT')
  }
}

function assertQuantity(value: number): void {
  if (!Number.isInteger(value) || value < 0 || value > MAX_PRIZE_QUANTITY) {
    throw new Error('INVALID_PRIZE_QUANTITY')
  }
}

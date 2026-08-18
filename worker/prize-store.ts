import {
  isPrizeCode,
  type PrizeAwardResult,
  type PrizeCatalogResponse,
  type PrizeCode,
  type PrizeDisplayItem,
  type PrizeInventoryItem,
  type PrizeInventoryResponse,
  type SpinRequest,
} from '../src/lib/prizes'

interface InventoryRow {
  readonly code: string
  readonly label: string
  readonly color: string
  readonly unlimited: number
  readonly enabled: number
  readonly weight: number
  readonly initial_quantity: number | null
  readonly remaining: number | null
  readonly total_wins: number
}

type PrizeRow = Omit<InventoryRow, 'total_wins'>

interface CatalogRow {
  readonly code: string
  readonly label: string
  readonly color: string
}

interface WinRow extends CatalogRow {
  readonly prize_code: string
}

export type PrizePicker = (available: readonly PrizeInventoryItem[]) => PrizeCode

export async function getPrizeInventory(db: D1Database): Promise<PrizeInventoryResponse> {
  const result = await db
    .prepare(
      `SELECT inventory.code, inventory.label, inventory.color, inventory.unlimited,
              inventory.initial_quantity, inventory.remaining, inventory.enabled,
              inventory.weight, stats.total_wins
       FROM prize_inventory_status AS inventory
       CROSS JOIN booth_stats AS stats
       WHERE stats.id = 1
       ORDER BY inventory.sort_order, inventory.code`,
    )
    .all<InventoryRow>()

  if (!result.success) throw new Error('INVENTORY_QUERY_FAILED')

  const prizes = result.results.map(toPrizeInventoryItem)

  return { prizes, totalWins: result.results[0]?.total_wins ?? 0 }
}

export async function getPrizeCatalog(db: D1Database): Promise<PrizeCatalogResponse> {
  const result = await db
    .prepare(
      `SELECT code, label, color
       FROM prize_inventory
       WHERE enabled = 1
       ORDER BY sort_order, code`,
    )
    .all<CatalogRow>()

  if (!result.success) throw new Error('PRIZE_CATALOG_QUERY_FAILED')
  return { prizes: result.results.map(toPrizeDisplayItem) }
}

export async function awardPrize(
  db: D1Database,
  input: SpinRequest,
  pick: PrizePicker = securePrizePicker,
): Promise<PrizeAwardResult> {
  const existing = await findExistingWin(db, input.attemptId)
  if (existing) return responseForExisting(db, existing)

  // 재고 조회 직후 다른 요청이나 운영자 수정이 마지막 슬롯을 가져갈 수 있다.
  // UNIQUE/FK 제약이 기록을 거절하면 최신 재고로 다시 뽑는다.
  for (let attempt = 0; attempt < 16; attempt += 1) {
    const available = await getAwardablePrizes(db)
    const prizeCode = pick(available)
    const selected = available.find((prize) => prize.code === prizeCode)
    if (!selected) throw new Error('INVALID_PRIZE_PICK')

    const stockSlot = selected.unlimited
      ? null
      : await findAvailableStockSlot(db, prizeCode)
    if (!selected.unlimited && stockSlot === null) continue

    try {
      await db
        .prepare(
          `INSERT INTO prize_wins
             (id, attempt_id, prize_code, stock_slot, quiz_score, quiz_total, elapsed_ms)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
        )
        .bind(
          crypto.randomUUID(),
          input.attemptId,
          prizeCode,
          stockSlot,
          input.score,
          input.total,
          input.elapsedMs,
        )
        .run()

      return buildAwardResult(db, toPrizeDisplayItem(selected), false)
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      // 같은 attemptId의 더블 탭은 UNIQUE 제약으로 하나만 남고 기존 결과를 재생한다.
      if (message.includes('UNIQUE constraint failed')) {
        const raced = await findExistingWin(db, input.attemptId)
        if (raced) return responseForExisting(db, raced)
        continue
      }
      // 운영자가 남은 수량을 줄이는 순간 선택한 슬롯이 사라졌다면 다시 뽑는다.
      if (
        message.includes('FOREIGN KEY constraint failed') ||
        message.includes('PRIZE_STOCK_UNAVAILABLE') ||
        message.includes('PRIZE_DISABLED')
      ) {
        continue
      }
      throw error
    }
  }

  throw new Error('PRIZE_SELECTION_RETRY_EXHAUSTED')
}

async function findAvailableStockSlot(
  db: D1Database,
  code: PrizeCode,
): Promise<number | null> {
  const row = await db
    .prepare(
      `SELECT stock_slot
       FROM prize_stock_units
       WHERE prize_code = ? AND claimed = 0
       ORDER BY stock_slot
       LIMIT 1`,
    )
    .bind(code)
    .first<{ stock_slot: number | null }>()
  return row?.stock_slot ?? null
}

async function findExistingWin(
  db: D1Database,
  attemptId: string,
): Promise<PrizeDisplayItem | null> {
  const row = await db
    .prepare(
      `SELECT wins.prize_code, inventory.code, inventory.label, inventory.color
       FROM prize_wins AS wins
       JOIN prize_inventory AS inventory ON inventory.code = wins.prize_code
       WHERE wins.attempt_id = ?`,
    )
    .bind(attemptId)
    .first<WinRow>()
  if (!row) return null
  if (row.prize_code !== row.code) throw new Error('INVALID_STORED_PRIZE_CODE')
  return toPrizeDisplayItem(row)
}

async function responseForExisting(
  db: D1Database,
  prize: PrizeDisplayItem,
): Promise<PrizeAwardResult> {
  return buildAwardResult(db, prize, true)
}

async function getAwardablePrizes(db: D1Database): Promise<readonly PrizeInventoryItem[]> {
  const result = await db
    .prepare(
      `SELECT code, label, color, unlimited, initial_quantity, remaining, enabled, weight
       FROM prize_inventory_status
       WHERE enabled = 1 AND (unlimited = 1 OR remaining > 0)
       ORDER BY sort_order, code`,
    )
    .all<PrizeRow>()

  if (!result.success) throw new Error('AVAILABLE_PRIZES_QUERY_FAILED')
  return result.results.map(toPrizeInventoryItem)
}

async function buildAwardResult(
  db: D1Database,
  prize: PrizeDisplayItem,
  replayed: boolean,
): Promise<PrizeAwardResult> {
  const catalog = await getPrizeCatalog(db)
  const prizes = [...catalog.prizes]
  if (!prizes.some((item) => item.code === prize.code)) {
    // 재생 사이에 운영자가 경품을 껐어도 이미 확정된 당첨 결과는 표시한다.
    prizes.push(prize)
  }
  return { prizes, prize, replayed }
}

function toPrizeInventoryItem(row: PrizeRow): PrizeInventoryItem {
  if (!isPrizeCode(row.code)) throw new Error('INVALID_STORED_PRIZE_CODE')
  if (row.unlimited !== 0 && row.unlimited !== 1) {
    throw new Error(`INVALID_STORED_UNLIMITED:${row.code}`)
  }
  if (row.enabled !== 0 && row.enabled !== 1) {
    throw new Error(`INVALID_STORED_ENABLED:${row.code}`)
  }
  if (!Number.isInteger(row.weight) || row.weight < 1 || row.weight > 100) {
    throw new Error(`INVALID_STORED_WEIGHT:${row.code}`)
  }
  return {
    ...toPrizeDisplayItem(row),
    remaining: row.remaining,
    initialQuantity: row.initial_quantity,
    unlimited: row.unlimited === 1,
    enabled: row.enabled === 1,
    weight: row.weight,
  }
}

function toPrizeDisplayItem(prize: CatalogRow): PrizeDisplayItem {
  if (!isPrizeCode(prize.code)) throw new Error('INVALID_STORED_PRIZE_CODE')
  return { code: prize.code, label: prize.label, color: prize.color }
}

function securePrizePicker(available: readonly PrizeInventoryItem[]): PrizeCode {
  if (available.length === 0) throw new Error('NO_PRIZE_AVAILABLE')
  const totalWeight = available.reduce((sum, prize) => sum + prize.weight, 0)
  if (!Number.isSafeInteger(totalWeight) || totalWeight < 1 || totalWeight > 2 ** 32) {
    throw new Error('INVALID_TOTAL_PRIZE_WEIGHT')
  }
  return prizeCodeForTicket(available, secureInteger(totalWeight))
}

/** 테스트 가능한 순수 경계 함수. ticket은 0부터 전체 가중치 합 직전까지다. */
export function prizeCodeForTicket(
  available: readonly PrizeInventoryItem[],
  ticket: number,
): PrizeCode {
  const totalWeight = available.reduce((sum, prize) => sum + prize.weight, 0)
  if (!Number.isInteger(ticket) || ticket < 0 || ticket >= totalWeight) {
    throw new Error('INVALID_PRIZE_TICKET')
  }

  let cursor = ticket
  for (const prize of available) {
    if (cursor < prize.weight) return prize.code
    cursor -= prize.weight
  }
  throw new Error('INVALID_PRIZE_TICKET')
}

function secureInteger(maxExclusive: number): number {
  if (!Number.isSafeInteger(maxExclusive) || maxExclusive < 1 || maxExclusive > 2 ** 32) {
    throw new Error('INVALID_RANDOM_RANGE')
  }
  if (maxExclusive === 1) return 0

  // 2^32를 범위로 나눈 나머지 구간을 버려 modulo bias를 없앤다.
  const range = 2 ** 32
  const ceiling = Math.floor(range / maxExclusive) * maxExclusive
  const random = new Uint32Array(1)
  do crypto.getRandomValues(random)
  while ((random[0] ?? range) >= ceiling)
  return (random[0] ?? 0) % maxExclusive
}

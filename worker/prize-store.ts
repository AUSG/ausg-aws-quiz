import {
  isPrizeCode,
  type PrizeAwardResult,
  type PrizeCatalogResponse,
  type PrizeCode,
  type PrizeDisplayItem,
  type PrizeInventoryItem,
  type PrizeInventoryResponse,
  type SpinRequest,
  type SpinResponse,
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

interface WinRow {
  readonly prize_code: string
}

export type PrizePicker = (available: readonly PrizeInventoryItem[]) => PrizeCode

export async function getPrizeInventory(db: D1Database): Promise<PrizeInventoryResponse> {
  const result = await db
    .prepare(
      `SELECT code, label, color, unlimited, initial_quantity, remaining,
              enabled, weight,
              (SELECT COUNT(*) FROM prize_wins) AS total_wins
       FROM prize_inventory_status
       ORDER BY sort_order, code`,
    )
    .all<InventoryRow>()

  if (!result.success) throw new Error('INVENTORY_QUERY_FAILED')

  const prizes = result.results.map<PrizeInventoryItem>((row) => {
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
      code: row.code,
      label: row.label,
      color: row.color,
      remaining: row.remaining,
      initialQuantity: row.initial_quantity,
      unlimited: row.unlimited === 1,
      enabled: row.enabled === 1,
      weight: row.weight,
    }
  })

  return { prizes, totalWins: result.results[0]?.total_wins ?? 0 }
}

export async function getPrizeCatalog(db: D1Database): Promise<PrizeCatalogResponse> {
  return toPrizeCatalog(await getPrizeInventory(db))
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
    const inventory = await getPrizeInventory(db)
    const available = inventory.prizes.filter(
      (prize) => prize.enabled && (prize.unlimited || (prize.remaining ?? 0) > 0),
    )
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

      const updated = await getPrizeInventory(db)
      const prize = updated.prizes.find((item) => item.code === prizeCode)
      if (!prize) throw new Error(`INVENTORY_ROW_MISSING:${prizeCode}`)
      return { ...updated, prize, replayed: false }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      // 같은 attemptId의 더블 탭은 UNIQUE 제약으로 하나만 남고 기존 결과를 재생한다.
      if (message.includes('UNIQUE constraint failed')) {
        const raced = await findExistingWin(db, input.attemptId)
        if (raced) return responseForExisting(db, raced)
        continue
      }
      // 운영자가 남은 수량을 줄이는 순간 선택한 슬롯이 사라졌다면 다시 뽑는다.
      if (message.includes('FOREIGN KEY constraint failed')) continue
      throw error
    }
  }

  throw new Error('PRIZE_SELECTION_RETRY_EXHAUSTED')
}

export function toPublicSpinResponse(result: PrizeAwardResult): SpinResponse {
  const visiblePrizes = result.prizes.filter((prize) => prize.enabled).map(toPrizeDisplayItem)
  if (!visiblePrizes.some((prize) => prize.code === result.prize.code)) {
    // 같은 attemptId 재생 사이에 운영자가 해당 경품을 껐어도 기존 당첨 결과는
    // 다시 표시할 수 있어야 한다.
    visiblePrizes.push(toPrizeDisplayItem(result.prize))
  }
  return {
    prizes: visiblePrizes,
    prize: toPrizeDisplayItem(result.prize),
    replayed: result.replayed,
  }
}

async function findAvailableStockSlot(
  db: D1Database,
  code: PrizeCode,
): Promise<number | null> {
  const row = await db
    .prepare(
      `SELECT MIN(stock.stock_slot) AS stock_slot
       FROM prize_stock_units AS stock
       LEFT JOIN prize_wins AS wins
         ON wins.prize_code = stock.prize_code
        AND wins.stock_slot = stock.stock_slot
       WHERE stock.prize_code = ? AND wins.id IS NULL`,
    )
    .bind(code)
    .first<{ stock_slot: number | null }>()
  return row?.stock_slot ?? null
}

async function findExistingWin(db: D1Database, attemptId: string): Promise<PrizeCode | null> {
  const row = await db
    .prepare('SELECT prize_code FROM prize_wins WHERE attempt_id = ?')
    .bind(attemptId)
    .first<WinRow>()
  if (!row) return null
  if (!isPrizeCode(row.prize_code)) throw new Error('INVALID_STORED_PRIZE_CODE')
  return row.prize_code
}

async function responseForExisting(db: D1Database, code: PrizeCode): Promise<PrizeAwardResult> {
  const inventory = await getPrizeInventory(db)
  const prize = inventory.prizes.find((item) => item.code === code)
  if (!prize) throw new Error(`INVENTORY_ROW_MISSING:${code}`)
  return { ...inventory, prize, replayed: true }
}

function toPrizeCatalog(inventory: PrizeInventoryResponse): PrizeCatalogResponse {
  return {
    prizes: inventory.prizes.filter((prize) => prize.enabled).map(toPrizeDisplayItem),
  }
}

function toPrizeDisplayItem(prize: PrizeInventoryItem): PrizeDisplayItem {
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

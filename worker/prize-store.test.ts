import { describe, expect, it } from 'vitest'
import { env } from 'cloudflare:test'
import {
  awardPrize,
  getPrizeInventory,
  prizeCodeForTicket,
  type PrizePicker,
} from './prize-store'
import { setPrizeDistribution, setPrizeRemaining } from './admin-prize-store'
import type { PrizeCode, SpinRequest } from '../src/lib/prizes'

function request(attemptId = crypto.randomUUID()): SpinRequest {
  return { attemptId, score: 5, total: 5, elapsedMs: 42_000 }
}

function always(code: PrizeCode): PrizePicker {
  return (available) => {
    expect(available.some((prize) => prize.code === code)).toBe(true)
    return code
  }
}

async function exhaust(code: Exclude<PrizeCode, 'sticker'>, count = 20) {
  const statements = Array.from({ length: count }, (_, index) =>
    env.DB.prepare(
      `INSERT INTO prize_wins
         (id, attempt_id, prize_code, stock_slot, quiz_score, quiz_total, elapsed_ms)
       VALUES (?, ?, ?, ?, 5, 5, 1000)`,
    ).bind(crypto.randomUUID(), crypto.randomUUID(), code, index + 1),
  )
  await env.DB.batch(statements)
}

describe('D1 prize inventory', () => {
  it('starts with unlimited stickers and 20 of each finite prize', async () => {
    const inventory = await getPrizeInventory(env.DB)

    expect(inventory.totalWins).toBe(0)
    expect(inventory.prizes.map(({ code, remaining }) => [code, remaining])).toEqual([
      ['sticker', null],
      ['tumbler', 20],
      ['cleaner', 20],
      ['notebook', 20],
    ])
    expect(inventory.prizes.every((prize) => prize.enabled && prize.weight === 1)).toBe(true)
  })

  it('uses relative integer weights to map the secure random ticket', async () => {
    const inventory = await getPrizeInventory(env.DB)
    const sticker = inventory.prizes.find((prize) => prize.code === 'sticker')!
    const tumbler = inventory.prizes.find((prize) => prize.code === 'tumbler')!
    const weighted = [{ ...sticker, weight: 1 }, { ...tumbler, weight: 3 }]

    expect(prizeCodeForTicket(weighted, 0)).toBe('sticker')
    expect(prizeCodeForTicket(weighted, 1)).toBe('tumbler')
    expect(prizeCodeForTicket(weighted, 3)).toBe('tumbler')
  })

  it('excludes a disabled prize from new awards', async () => {
    await setPrizeDistribution(env.DB, 'sticker', false, 10)
    const picker: PrizePicker = (available) => {
      expect(available.some((prize) => prize.code === 'sticker')).toBe(false)
      return 'tumbler'
    }

    const result = await awardPrize(env.DB, request(), picker)
    expect(result.prize.code).toBe('tumbler')
  })

  it('records a finite prize win and decrements exactly one item', async () => {
    const result = await awardPrize(env.DB, request(), always('tumbler'))
    const inventory = await getPrizeInventory(env.DB)

    expect(result.prize.code).toBe('tumbler')
    expect(result.replayed).toBe(false)
    expect(inventory.prizes.find((prize) => prize.code === 'tumbler')?.remaining).toBe(19)
    expect(inventory.totalWins).toBe(1)
  })

  it('replays the same attempt id without another record or decrement', async () => {
    const attemptId = crypto.randomUUID()
    const first = await awardPrize(env.DB, request(attemptId), always('cleaner'))
    const replay = await awardPrize(env.DB, request(attemptId), always('notebook'))

    expect(first.prize.code).toBe('cleaner')
    expect(replay.prize.code).toBe('cleaner')
    expect(replay.replayed).toBe(true)
    const inventory = await getPrizeInventory(env.DB)
    expect(inventory.prizes.find((prize) => prize.code === 'cleaner')?.remaining).toBe(19)
    expect(inventory.prizes.find((prize) => prize.code === 'notebook')?.remaining).toBe(20)
    expect(inventory.totalWins).toBe(1)
  })

  it('replays an already awarded prize even when the admin disables it afterward', async () => {
    const attemptId = crypto.randomUUID()
    await awardPrize(env.DB, request(attemptId), always('tumbler'))
    await setPrizeDistribution(env.DB, 'tumbler', false, 1)

    const replay = await awardPrize(env.DB, request(attemptId), always('sticker'))

    expect(replay.replayed).toBe(true)
    expect(replay.prize.code).toBe('tumbler')
    expect(replay.prizes.filter((prize) => prize.code === 'tumbler')).toHaveLength(1)
  })

  it('coalesces concurrent retries for one attempt into a single win', async () => {
    const attemptId = crypto.randomUUID()
    const [first, second] = await Promise.all([
      awardPrize(env.DB, request(attemptId), always('tumbler')),
      awardPrize(env.DB, request(attemptId), always('cleaner')),
    ])

    expect(first.prize.code).toBe(second.prize.code)
    expect([first.replayed, second.replayed].sort()).toEqual([false, true])
    const inventory = await getPrizeInventory(env.DB)
    expect(inventory.totalWins).toBe(1)
    expect(
      inventory.prizes
        .filter((prize) => prize.code === 'tumbler' || prize.code === 'cleaner')
        .reduce((sum, prize) => sum + (prize.remaining ?? 0), 0),
    ).toBe(39)
  })

  it('never awards the same last unit to two concurrent attempts', async () => {
    await setPrizeDistribution(env.DB, 'sticker', false, 1)
    await setPrizeDistribution(env.DB, 'cleaner', false, 1)
    await setPrizeDistribution(env.DB, 'notebook', false, 1)
    await setPrizeRemaining(env.DB, 'tumbler', 1)

    const outcomes = await Promise.allSettled([
      awardPrize(env.DB, request()),
      awardPrize(env.DB, request()),
    ])
    const fulfilled = outcomes.filter((outcome) => outcome.status === 'fulfilled')
    const rejected = outcomes.filter((outcome) => outcome.status === 'rejected')

    expect(fulfilled).toHaveLength(1)
    expect(rejected).toHaveLength(1)
    expect(String(rejected[0]?.reason)).toContain('NO_PRIZE_AVAILABLE')
    const inventory = await getPrizeInventory(env.DB)
    expect(inventory.prizes.find((prize) => prize.code === 'tumbler')?.remaining).toBe(0)
    expect(inventory.totalWins).toBe(1)
  })

  it('awards only stickers after every finite prize is exhausted', async () => {
    await exhaust('tumbler')
    await exhaust('cleaner')
    await exhaust('notebook')

    const result = await awardPrize(env.DB, request())
    const inventory = await getPrizeInventory(env.DB)

    expect(result.prize.code).toBe('sticker')
    expect(
      inventory.prizes.filter((prize) => prize.unlimited || (prize.remaining ?? 0) > 0),
    ).toHaveLength(1)
  })

  it('prevents inventory from dropping below zero', async () => {
    await exhaust('notebook')
    const insert = () =>
      env.DB.prepare(
        `INSERT INTO prize_wins
           (id, attempt_id, prize_code, stock_slot, quiz_score, quiz_total, elapsed_ms)
         VALUES (?, ?, 'notebook', 20, 5, 5, 1000)`,
      )
        .bind(crypto.randomUUID(), crypto.randomUUID())
        .run()

    await expect(insert()).rejects.toThrow(/PRIZE_STOCK_UNAVAILABLE|UNIQUE constraint failed/)

    const row = await env.DB.prepare(
      "SELECT remaining FROM prize_inventory_status WHERE code = 'notebook'",
    ).first<{ remaining: number }>()
    expect(row?.remaining).toBe(0)
  })

  it('keeps materialized counters consistent when a win is removed for recovery', async () => {
    const attemptId = crypto.randomUUID()
    await awardPrize(env.DB, request(attemptId), always('notebook'))

    await env.DB.prepare('DELETE FROM prize_wins WHERE attempt_id = ?').bind(attemptId).run()

    const inventory = await getPrizeInventory(env.DB)
    expect(inventory.prizes.find((prize) => prize.code === 'notebook')?.remaining).toBe(20)
    expect(inventory.totalWins).toBe(0)
    const slot = await env.DB.prepare(
      "SELECT claimed FROM prize_stock_units WHERE prize_code = 'notebook' AND stock_slot = 1",
    ).first<{ claimed: number }>()
    expect(slot?.claimed).toBe(0)
  })

  it('serves inventory from materialized counters instead of scanning the win log', async () => {
    const view = await env.DB.prepare(
      "SELECT sql FROM sqlite_schema WHERE type = 'view' AND name = 'prize_inventory_status'",
    ).first<{ sql: string }>()
    const index = await env.DB.prepare(
      "SELECT name FROM sqlite_schema WHERE type = 'index' AND name = 'prize_stock_units_available_idx'",
    ).first<{ name: string }>()
    const plan = await env.DB.prepare(
      `EXPLAIN QUERY PLAN
       SELECT stock_slot
       FROM prize_stock_units
       WHERE prize_code = 'tumbler' AND claimed = 0
       ORDER BY stock_slot
       LIMIT 1`,
    ).all<{ detail: string }>()

    expect(view?.sql).toContain('prize_stock_counts')
    expect(view?.sql).not.toContain('prize_wins')
    expect(index?.name).toBe('prize_stock_units_available_idx')
    expect(plan.results.some((row) => row.detail.includes('prize_stock_units_available_idx'))).toBe(
      true,
    )
  })
})

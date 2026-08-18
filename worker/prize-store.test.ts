import { describe, expect, it } from 'vitest'
import { env } from 'cloudflare:test'
import {
  awardPrize,
  getPrizeInventory,
  prizeCodeForTicket,
  type PrizePicker,
} from './prize-store'
import { setPrizeDistribution } from './admin-prize-store'
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

    expect(result.prize.code).toBe('tumbler')
    expect(result.replayed).toBe(false)
    expect(result.prizes.find((prize) => prize.code === 'tumbler')?.remaining).toBe(19)
    expect(result.totalWins).toBe(1)
  })

  it('replays the same attempt id without another record or decrement', async () => {
    const attemptId = crypto.randomUUID()
    const first = await awardPrize(env.DB, request(attemptId), always('cleaner'))
    const replay = await awardPrize(env.DB, request(attemptId), always('notebook'))

    expect(first.prize.code).toBe('cleaner')
    expect(replay.prize.code).toBe('cleaner')
    expect(replay.replayed).toBe(true)
    expect(replay.prizes.find((prize) => prize.code === 'cleaner')?.remaining).toBe(19)
    expect(replay.prizes.find((prize) => prize.code === 'notebook')?.remaining).toBe(20)
    expect(replay.totalWins).toBe(1)
  })

  it('awards only stickers after every finite prize is exhausted', async () => {
    await exhaust('tumbler')
    await exhaust('cleaner')
    await exhaust('notebook')

    const result = await awardPrize(env.DB, request())

    expect(result.prize.code).toBe('sticker')
    expect(result.prizes.filter((prize) => prize.unlimited || (prize.remaining ?? 0) > 0)).toHaveLength(1)
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

    await expect(insert()).rejects.toThrow(/UNIQUE constraint failed/)

    const row = await env.DB.prepare(
      "SELECT remaining FROM prize_inventory_status WHERE code = 'notebook'",
    ).first<{ remaining: number }>()
    expect(row?.remaining).toBe(0)
  })
})

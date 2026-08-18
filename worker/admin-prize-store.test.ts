import { describe, expect, it } from 'vitest'
import { env } from 'cloudflare:test'
import { createPrize, setPrizeDistribution, setPrizeRemaining } from './admin-prize-store'
import { awardPrize, getPrizeCatalog, getPrizeInventory, type PrizePicker } from './prize-store'
import type { SpinRequest } from '../src/lib/prizes'

function spinRequest(attemptId = crypto.randomUUID()): SpinRequest {
  return { attemptId, score: 2, total: 5, elapsedMs: 32_000 }
}

describe('D1 admin prize inventory', () => {
  it('registers a new finite prize with its color and starting quantity', async () => {
    await createPrize(env.DB, {
      label: '키링',
      quantity: 5,
      color: '#7c3aed',
    })
    const inventory = await getPrizeInventory(env.DB)
    const prize = inventory.prizes.find((item) => item.label === '키링')

    expect(prize).toMatchObject({
      color: '#7c3aed',
      remaining: 5,
      initialQuantity: 5,
      unlimited: false,
      enabled: true,
      weight: 1,
    })
    expect(prize?.code).toMatch(/^custom-/)
  })

  it('changes remaining quantity without deleting an existing win', async () => {
    const attemptId = crypto.randomUUID()
    const tumblerPicker: PrizePicker = () => 'tumbler'
    await awardPrize(env.DB, spinRequest(attemptId), tumblerPicker)

    await setPrizeRemaining(env.DB, 'tumbler', 7)
    let inventory = await getPrizeInventory(env.DB)
    expect(inventory.prizes.find((prize) => prize.code === 'tumbler')).toMatchObject({
      remaining: 7,
      initialQuantity: 8,
    })

    await setPrizeRemaining(env.DB, 'tumbler', 12)
    inventory = await getPrizeInventory(env.DB)
    expect(inventory.prizes.find((prize) => prize.code === 'tumbler')).toMatchObject({
      remaining: 12,
      initialQuantity: 13,
    })

    const replay = await awardPrize(env.DB, spinRequest(attemptId), () => 'sticker')
    expect(replay.replayed).toBe(true)
    expect(replay.prize.code).toBe('tumbler')
    expect((await getPrizeInventory(env.DB)).totalWins).toBe(1)
  })

  it('keeps a zero-quantity prize in the wheel catalog but excludes it from awards', async () => {
    await createPrize(env.DB, {
      label: '품절 키링',
      quantity: 0,
      color: '#334455',
    })
    const created = await getPrizeInventory(env.DB)
    const soldOut = created.prizes.find((prize) => prize.label === '품절 키링')
    expect(soldOut?.remaining).toBe(0)

    const catalog = await getPrizeCatalog(env.DB)
    expect(catalog.prizes.some((prize) => prize.code === soldOut?.code)).toBe(true)

    const picker: PrizePicker = (available) => {
      expect(available.some((prize) => prize.code === soldOut?.code)).toBe(false)
      return 'sticker'
    }
    const result = await awardPrize(env.DB, spinRequest(), picker)
    expect(result.prize.code).toBe('sticker')

    await setPrizeRemaining(env.DB, soldOut!.code, 2)
    const restocked = await awardPrize(env.DB, spinRequest(), (available) => {
      expect(available.some((prize) => prize.code === soldOut?.code)).toBe(true)
      return soldOut!.code
    })
    expect(restocked.prize.code).toBe(soldOut?.code)
    expect(
      (await getPrizeInventory(env.DB)).prizes.find((prize) => prize.code === soldOut?.code)
        ?.remaining,
    ).toBe(1)
  })

  it('does not allow editing the unlimited sticker quantity', async () => {
    await expect(setPrizeRemaining(env.DB, 'sticker', 10)).rejects.toThrow(
      'UNLIMITED_PRIZE_QUANTITY',
    )
    const inventory = await getPrizeInventory(env.DB)
    expect(inventory.prizes.find((prize) => prize.code === 'sticker')?.remaining).toBeNull()
  })

  it('changes distribution weight and hides a disabled prize from the public wheel', async () => {
    await setPrizeDistribution(env.DB, 'notebook', true, 7)
    let inventory = await getPrizeInventory(env.DB)
    expect(inventory.prizes.find((prize) => prize.code === 'notebook')).toMatchObject({
      enabled: true,
      weight: 7,
    })

    await setPrizeDistribution(env.DB, 'notebook', false, 7)
    inventory = await getPrizeInventory(env.DB)
    expect(inventory.prizes.find((prize) => prize.code === 'notebook')?.enabled).toBe(false)
    expect((await getPrizeCatalog(env.DB)).prizes.some((prize) => prize.code === 'notebook')).toBe(false)
  })

  it('keeps at least one prize enabled', async () => {
    await setPrizeDistribution(env.DB, 'tumbler', false, 1)
    await setPrizeDistribution(env.DB, 'cleaner', false, 1)
    await setPrizeDistribution(env.DB, 'notebook', false, 1)
    await expect(setPrizeDistribution(env.DB, 'sticker', false, 1)).rejects.toThrow(
      /LAST_ENABLED_PRIZE/,
    )
  })

  it('keeps live counters valid when a quantity edit races with a spin', async () => {
    await Promise.all([
      setPrizeRemaining(env.DB, 'tumbler', 1),
      awardPrize(env.DB, spinRequest(), () => 'tumbler'),
    ])

    const inventory = await getPrizeInventory(env.DB)
    const tumbler = inventory.prizes.find((prize) => prize.code === 'tumbler')
    expect(tumbler?.remaining === 0 || tumbler?.remaining === 1).toBe(true)
    expect(tumbler?.initialQuantity).toBe((tumbler?.remaining ?? 0) + 1)
    expect(inventory.totalWins).toBe(1)
  })
})

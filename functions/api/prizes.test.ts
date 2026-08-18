import { describe, expect, it } from 'vitest'
import { env } from 'cloudflare:test'
import {
  createPrize,
  setPrizeDistribution,
  setPrizeRemaining,
} from '../../worker/admin-prize-store'
import { getPrizeInventory } from '../../worker/prize-store'
import { onRequestGet } from './prizes'

async function getCatalog() {
  const response = await onRequestGet({
    env,
    request: new Request('https://quiz.example/api/prizes'),
  } as unknown as Parameters<typeof onRequestGet>[0])
  const body = await response.json<{ prizes: Array<{ code: string; label: string }> }>()
  return { response, body }
}

describe('GET /api/prizes', () => {
  it('returns every registered prize without exposing stock quantities', async () => {
    await setPrizeRemaining(env.DB, 'notebook', 0)
    const response = await onRequestGet({
      env,
      request: new Request('https://quiz.example/api/prizes'),
    } as unknown as Parameters<typeof onRequestGet>[0])
    const body = await response.json<{ prizes: Array<Record<string, unknown>> }>()

    expect(response.status).toBe(200)
    expect(body.prizes.map((prize) => prize.code)).toContain('notebook')
    for (const prize of body.prizes) {
      expect(prize).not.toHaveProperty('remaining')
      expect(prize).not.toHaveProperty('initialQuantity')
      expect(prize).not.toHaveProperty('unlimited')
      expect(prize).not.toHaveProperty('enabled')
      expect(prize).not.toHaveProperty('weight')
    }
  })

  it('hides a disabled prize while keeping an enabled sold-out prize visible', async () => {
    await setPrizeRemaining(env.DB, 'notebook', 0)
    await setPrizeDistribution(env.DB, 'cleaner', false, 5)
    const response = await onRequestGet({
      env,
      request: new Request('https://quiz.example/api/prizes'),
    } as unknown as Parameters<typeof onRequestGet>[0])
    const body = await response.json<{ prizes: Array<{ code: string }> }>()

    expect(body.prizes.some((prize) => prize.code === 'notebook')).toBe(true)
    expect(body.prizes.some((prize) => prize.code === 'cleaner')).toBe(false)
  })

  it('reflects prize registration and enable changes on the very next request', async () => {
    const before = await getCatalog()
    expect(before.body.prizes.some((prize) => prize.label === '실시간 키링')).toBe(false)

    await createPrize(env.DB, {
      label: '실시간 키링',
      quantity: 0,
      color: '#123abc',
    })
    const created = (await getPrizeInventory(env.DB)).prizes.find(
      (prize) => prize.label === '실시간 키링',
    )
    expect(created).toBeDefined()

    const afterCreate = await getCatalog()
    expect(afterCreate.response.headers.get('Cache-Control')).toBe('no-store')
    expect(afterCreate.body.prizes.some((prize) => prize.code === created?.code)).toBe(true)

    await setPrizeDistribution(env.DB, created!.code, false, 1)
    const afterDisable = await getCatalog()
    expect(afterDisable.body.prizes.some((prize) => prize.code === created?.code)).toBe(false)
  })
})

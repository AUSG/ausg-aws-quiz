import { describe, expect, it } from 'vitest'
import { env } from 'cloudflare:test'
import { setPrizeDistribution, setPrizeRemaining } from '../../worker/admin-prize-store'
import { onRequestGet } from './prizes'

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
})

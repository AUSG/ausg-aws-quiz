import { describe, expect, it } from 'vitest'
import { env } from 'cloudflare:test'
import { setPrizeDistribution, setPrizeRemaining } from '../../worker/admin-prize-store'
import { onRequestPost } from './spin'

function context(body: unknown, headers: Record<string, string> = {}) {
  return {
    env,
    request: new Request('https://quiz.example/api/spin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: 'https://quiz.example', ...headers },
      body: JSON.stringify(body),
    }),
  } as unknown as Parameters<typeof onRequestPost>[0]
}

describe('POST /api/spin', () => {
  it('returns a prize and public catalog without stock quantities', async () => {
    const response = await onRequestPost(
      context({ attemptId: crypto.randomUUID(), score: 5, total: 5, elapsedMs: 10_000 }),
    )
    const body = await response.json<{
      prize: Record<string, unknown> & { code: string }
      prizes: Array<Record<string, unknown>>
    }>()

    expect(response.status).toBe(200)
    expect(['sticker', 'tumbler', 'cleaner', 'notebook']).toContain(body.prize.code)
    expect(body.prizes).toHaveLength(4)
    expect(body.prize).not.toHaveProperty('remaining')
    expect(body.prizes[0]).not.toHaveProperty('remaining')
    expect(body.prize).not.toHaveProperty('enabled')
    expect(body.prize).not.toHaveProperty('weight')
    expect(body.prizes[0]).not.toHaveProperty('enabled')
    expect(body.prizes[0]).not.toHaveProperty('weight')
    expect(response.headers.get('Cache-Control')).toBe('no-store')
  })

  it('never awards or exposes a disabled prize', async () => {
    await setPrizeDistribution(env.DB, 'tumbler', false, 100)
    await setPrizeDistribution(env.DB, 'cleaner', false, 100)
    await setPrizeDistribution(env.DB, 'notebook', false, 100)

    const response = await onRequestPost(
      context({ attemptId: crypto.randomUUID(), score: 3, total: 3, elapsedMs: 10_000 }),
    )
    const body = await response.json<{
      prize: { code: string }
      prizes: Array<{ code: string }>
    }>()

    expect(response.status).toBe(200)
    expect(body.prize.code).toBe('sticker')
    expect(body.prizes.map((prize) => prize.code)).toEqual(['sticker'])
  })

  it('returns a clear conflict when every enabled prize is out of stock', async () => {
    await setPrizeDistribution(env.DB, 'sticker', false, 1)
    await setPrizeDistribution(env.DB, 'cleaner', false, 1)
    await setPrizeDistribution(env.DB, 'notebook', false, 1)
    await setPrizeRemaining(env.DB, 'tumbler', 0)

    const response = await onRequestPost(
      context({ attemptId: crypto.randomUUID(), score: 3, total: 3, elapsedMs: 10_000 }),
    )
    const body = await response.json<{ error: string }>()

    expect(response.status).toBe(409)
    expect(body.error).toContain('지급 가능한 굿즈가 없어요')
  })

  it('rejects a cross-origin request', async () => {
    const response = await onRequestPost(
      context(
        { attemptId: crypto.randomUUID(), score: 5, total: 5, elapsedMs: 10_000 },
        { Origin: 'https://attacker.example' },
      ),
    )
    expect(response.status).toBe(403)
  })

  it('rejects an invalid UUID and score', async () => {
    const response = await onRequestPost(
      context({ attemptId: 'not-a-uuid', score: 9, total: 5, elapsedMs: 10_000 }),
    )
    expect(response.status).toBe(400)
  })
})

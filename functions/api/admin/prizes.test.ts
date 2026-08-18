import { describe, expect, it } from 'vitest'
import { env } from 'cloudflare:test'
import { onRequestGet, onRequestPatch, onRequestPost } from './prizes'

function request(method: 'GET' | 'POST' | 'PATCH', body?: unknown, code = '2018') {
  return new Request('https://quiz.example/api/admin/prizes', {
    method,
    headers: {
      Accept: 'application/json',
      'X-Admin-Code': code,
      Origin: 'https://quiz.example',
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
}

function context(req: Request) {
  return { env, request: req } as unknown as Parameters<typeof onRequestGet>[0]
}

describe('/api/admin/prizes', () => {
  it('requires the booth admin code', async () => {
    const response = await onRequestGet(context(request('GET', undefined, 'wrong')))
    expect(response.status).toBe(401)
  })

  it('returns quantities only through the admin endpoint', async () => {
    const response = await onRequestGet(context(request('GET')))
    const body = await response.json<{
      prizes: Array<Record<string, unknown>>
      settings: { questionCount: number }
    }>()

    expect(response.status).toBe(200)
    expect(body.prizes[0]).toHaveProperty('remaining')
    expect(body.prizes[0]).toHaveProperty('enabled', true)
    expect(body.prizes[0]).toHaveProperty('weight', 1)
    expect(body.settings.questionCount).toBe(3)
    expect(response.headers.get('Cache-Control')).toBe('no-store')
  })

  it('registers a prize and changes its remaining quantity', async () => {
    const createdResponse = await onRequestPost(
      context(request('POST', { label: '파우치', quantity: 4, color: '#123abc' })),
    )
    const created = await createdResponse.json<{
      prizes: Array<{ code: string; label: string; remaining: number | null }>
    }>()
    const pouch = created.prizes.find((prize) => prize.label === '파우치')

    expect(createdResponse.status).toBe(201)
    expect(pouch?.remaining).toBe(4)

    const updatedResponse = await onRequestPatch(
      context(request('PATCH', { action: 'quantity', code: pouch?.code, remaining: 0 })),
    )
    const updated = await updatedResponse.json<{
      prizes: Array<{ code: string; remaining: number | null }>
    }>()
    expect(updatedResponse.status).toBe(200)
    expect(updated.prizes.find((prize) => prize.code === pouch?.code)?.remaining).toBe(0)
  })

  it('rejects malformed quantities', async () => {
    const response = await onRequestPost(
      context(request('POST', { label: '파우치', quantity: -1, color: '#123abc' })),
    )
    expect(response.status).toBe(400)
  })

  it('changes prize distribution and quiz question count', async () => {
    const distributionResponse = await onRequestPatch(
      context(
        request('PATCH', {
          action: 'distribution',
          code: 'notebook',
          enabled: false,
          weight: 8,
        }),
      ),
    )
    const distribution = await distributionResponse.json<{
      prizes: Array<{ code: string; enabled: boolean; weight: number }>
    }>()
    expect(distributionResponse.status).toBe(200)
    expect(distribution.prizes.find((prize) => prize.code === 'notebook')).toMatchObject({
      enabled: false,
      weight: 8,
    })

    const settingsResponse = await onRequestPatch(
      context(request('PATCH', { action: 'settings', questionCount: 5 })),
    )
    const settings = await settingsResponse.json<{ settings: { questionCount: number } }>()
    expect(settingsResponse.status).toBe(200)
    expect(settings.settings.questionCount).toBe(5)
  })
})

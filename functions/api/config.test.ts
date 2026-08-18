import { describe, expect, it } from 'vitest'
import { env } from 'cloudflare:test'
import { setQuestionCount } from '../../worker/booth-settings'
import { onRequestGet } from './config'

describe('GET /api/config', () => {
  it('returns the persisted 3~5 question setting without caching', async () => {
    await setQuestionCount(env.DB, 4)
    const response = await onRequestGet({
      env,
      request: new Request('https://quiz.example/api/config'),
    } as unknown as Parameters<typeof onRequestGet>[0])

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ questionCount: 4 })
    expect(response.headers.get('Cache-Control')).toBe('no-store')
  })
})

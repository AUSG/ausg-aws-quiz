import { describe, expect, it } from 'vitest'
import { env } from 'cloudflare:test'
import { getBoothSettings, setQuestionCount } from './booth-settings'

describe('D1 booth settings', () => {
  it('starts at 3 questions and accepts 3 through 5', async () => {
    expect(await getBoothSettings(env.DB)).toEqual({ questionCount: 3 })
    expect(await setQuestionCount(env.DB, 5)).toEqual({ questionCount: 5 })
    expect(await getBoothSettings(env.DB)).toEqual({ questionCount: 5 })
  })

  it('rejects counts outside 3 through 5', async () => {
    await expect(setQuestionCount(env.DB, 2)).rejects.toThrow('INVALID_QUESTION_COUNT')
    await expect(setQuestionCount(env.DB, 6)).rejects.toThrow('INVALID_QUESTION_COUNT')
  })
})

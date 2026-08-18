import type { SpinRequest } from '../../src/lib/prizes'
import { API_HEADERS } from '../../worker/http'
import { awardPrize } from '../../worker/prize-store'

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const MAX_BODY_BYTES = 1024

export const onRequestPost: PagesFunction<Env> = async ({ env, request }) => {
  const requestUrl = new URL(request.url)
  const origin = request.headers.get('Origin')
  if (origin !== null && origin !== requestUrl.origin) {
    return Response.json({ error: '허용되지 않은 요청이에요.' }, { status: 403, headers: API_HEADERS })
  }

  const contentType = request.headers.get('Content-Type') ?? ''
  if (!contentType.toLowerCase().startsWith('application/json')) {
    return Response.json({ error: 'JSON 요청이 필요해요.' }, { status: 415, headers: API_HEADERS })
  }

  const contentLength = Number(request.headers.get('Content-Length') ?? 0)
  if (Number.isFinite(contentLength) && contentLength > MAX_BODY_BYTES) {
    return Response.json({ error: '요청이 너무 커요.' }, { status: 413, headers: API_HEADERS })
  }

  try {
    const rawBody = await request.text()
    if (new TextEncoder().encode(rawBody).byteLength > MAX_BODY_BYTES) {
      return Response.json({ error: '요청이 너무 커요.' }, { status: 413, headers: API_HEADERS })
    }
    let body: unknown
    try {
      body = JSON.parse(rawBody)
    } catch {
      return Response.json(
        { error: '룰렛 요청 형식이 올바르지 않아요.' },
        { status: 400, headers: API_HEADERS },
      )
    }
    const input = parseSpinRequest(body)
    if (!input) {
      return Response.json({ error: '룰렛 요청 형식이 올바르지 않아요.' }, { status: 400, headers: API_HEADERS })
    }

    const result = await awardPrize(env.DB, input)
    return Response.json(result, { headers: API_HEADERS })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error(
      JSON.stringify({
        message: 'spin request failed',
        error: message,
        path: requestUrl.pathname,
      }),
    )
    if (message === 'NO_PRIZE_AVAILABLE') {
      return Response.json(
        { error: '현재 지급 가능한 굿즈가 없어요. 운영진에게 알려주세요.' },
        { status: 409, headers: API_HEADERS },
      )
    }
    return Response.json(
      { error: '당첨 결과를 정하지 못했어요. 다시 눌러주세요.' },
      { status: 500, headers: API_HEADERS },
    )
  }
}

function parseSpinRequest(value: unknown): SpinRequest | null {
  if (!isRecord(value)) return null
  const { attemptId, score, total, elapsedMs } = value
  if (typeof attemptId !== 'string' || !UUID_PATTERN.test(attemptId)) return null
  if (typeof score !== 'number' || !Number.isInteger(score) || score < 0) return null
  if (typeof total !== 'number' || !Number.isInteger(total) || total < 1 || total > 10) return null
  if (score > total) return null
  if (typeof elapsedMs !== 'number' || !Number.isInteger(elapsedMs)) return null
  if (elapsedMs < 0 || elapsedMs > 600_000) return null
  return { attemptId, score, total, elapsedMs }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

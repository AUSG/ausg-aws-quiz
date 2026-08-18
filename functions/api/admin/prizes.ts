import {
  MAX_PRIZE_WEIGHT,
  MIN_PRIZE_WEIGHT,
  type AdminBoothStateResponse,
  type PrizeCode,
} from '../../../src/lib/prizes'
import {
  MAX_QUESTION_COUNT,
  MIN_QUESTION_COUNT,
} from '../../../src/lib/booth-settings'
import {
  createPrize,
  MAX_PRIZE_LABEL_LENGTH,
  MAX_PRIZE_QUANTITY,
  setPrizeDistribution,
  setPrizeRemaining,
  type CreatePrizeInput,
} from '../../../worker/admin-prize-store'
import { API_HEADERS } from '../../../worker/http'
import { getBoothSettings, setQuestionCount } from '../../../worker/booth-settings'
import { getPrizeInventory } from '../../../worker/prize-store'

// 행사 부스용의 가벼운 오입력 방지 장치다. 클라이언트 번들에도 같은 값이 있어
// 실제 보안 경계로 취급하지 않는다.
const ADMIN_CODE = '2018'
const MAX_BODY_BYTES = 1024

export const onRequestGet: PagesFunction<Env> = async ({ env, request }) => {
  if (!isAuthorized(request)) return unauthorized()
  try {
    return Response.json(await getAdminState(env.DB), { headers: API_HEADERS })
  } catch (error) {
    return unexpectedError(error, request)
  }
}

export const onRequestPost: PagesFunction<Env> = async ({ env, request }) => {
  const rejected = rejectMutationRequest(request)
  if (rejected) return rejected

  const body = await readJsonBody(request)
  if (body instanceof Response) return body
  const input = parseCreatePrize(body)
  if (!input) return invalidInput('상품명, 수량, 색상을 확인해주세요.')

  try {
    await createPrize(env.DB, input)
    return Response.json(await getAdminState(env.DB), { status: 201, headers: API_HEADERS })
  } catch (error) {
    return knownOrUnexpectedError(error, request)
  }
}

export const onRequestPatch: PagesFunction<Env> = async ({ env, request }) => {
  const rejected = rejectMutationRequest(request)
  if (rejected) return rejected

  const body = await readJsonBody(request)
  if (body instanceof Response) return body
  const input = parseAdminChange(body)
  if (!input) return invalidInput('변경할 운영 설정을 확인해주세요.')

  try {
    if (input.action === 'quantity') {
      await setPrizeRemaining(env.DB, input.code, input.remaining)
    } else if (input.action === 'distribution') {
      await setPrizeDistribution(env.DB, input.code, input.enabled, input.weight)
    } else {
      await setQuestionCount(env.DB, input.questionCount)
    }
    return Response.json(await getAdminState(env.DB), { headers: API_HEADERS })
  } catch (error) {
    return knownOrUnexpectedError(error, request)
  }
}

function rejectMutationRequest(request: Request): Response | null {
  if (!isAuthorized(request)) return unauthorized()
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
  return null
}

async function readJsonBody(request: Request): Promise<unknown | Response> {
  const rawBody = await request.text()
  if (new TextEncoder().encode(rawBody).byteLength > MAX_BODY_BYTES) {
    return Response.json({ error: '요청이 너무 커요.' }, { status: 413, headers: API_HEADERS })
  }
  try {
    return JSON.parse(rawBody) as unknown
  } catch {
    return invalidInput('요청 형식이 올바르지 않아요.')
  }
}

function parseCreatePrize(value: unknown): CreatePrizeInput | null {
  if (!isRecord(value)) return null
  const { label, quantity, color } = value
  if (typeof label !== 'string' || label.trim().length === 0) return null
  if (label.trim().length > MAX_PRIZE_LABEL_LENGTH) return null
  if (!isQuantity(quantity)) return null
  if (typeof color !== 'string' || !/^#[0-9a-f]{6}$/i.test(color)) return null
  return { label: label.trim(), quantity, color }
}

type AdminChange =
  | {
      readonly action: 'quantity'
      readonly code: PrizeCode
      readonly remaining: number
    }
  | {
      readonly action: 'distribution'
      readonly code: PrizeCode
      readonly enabled: boolean
      readonly weight: number
    }
  | {
      readonly action: 'settings'
      readonly questionCount: number
    }

function parseAdminChange(value: unknown): AdminChange | null {
  if (!isRecord(value)) return null
  if (value.action === 'settings') {
    if (!isQuestionCount(value.questionCount)) return null
    return { action: 'settings', questionCount: value.questionCount }
  }

  if (typeof value.code !== 'string' || !/^[a-z0-9][a-z0-9-]{0,63}$/.test(value.code)) {
    return null
  }
  if (value.action === 'distribution') {
    if (typeof value.enabled !== 'boolean' || !isWeight(value.weight)) return null
    return {
      action: 'distribution',
      code: value.code,
      enabled: value.enabled,
      weight: value.weight,
    }
  }
  // action이 없는 기존 클라이언트 요청도 행사 중 배포 교체에 안전하게 받는다.
  if (value.action === undefined || value.action === 'quantity') {
    if (!isQuantity(value.remaining)) return null
    return { action: 'quantity', code: value.code, remaining: value.remaining }
  }
  return null
}

function isQuantity(value: unknown): value is number {
  return Number.isInteger(value) && Number(value) >= 0 && Number(value) <= MAX_PRIZE_QUANTITY
}

function isWeight(value: unknown): value is number {
  return (
    Number.isInteger(value) &&
    Number(value) >= MIN_PRIZE_WEIGHT &&
    Number(value) <= MAX_PRIZE_WEIGHT
  )
}

function isQuestionCount(value: unknown): value is number {
  return (
    Number.isInteger(value) &&
    Number(value) >= MIN_QUESTION_COUNT &&
    Number(value) <= MAX_QUESTION_COUNT
  )
}

function isAuthorized(request: Request): boolean {
  return request.headers.get('X-Admin-Code') === ADMIN_CODE
}

function unauthorized(): Response {
  return Response.json({ error: '관리자 비밀번호를 확인해주세요.' }, { status: 401, headers: API_HEADERS })
}

function invalidInput(message: string): Response {
  return Response.json({ error: message }, { status: 400, headers: API_HEADERS })
}

function knownOrUnexpectedError(error: unknown, request: Request): Response {
  const message = error instanceof Error ? error.message : String(error)
  if (message === 'PRIZE_NOT_FOUND') {
    return Response.json({ error: '상품을 찾을 수 없어요.' }, { status: 404, headers: API_HEADERS })
  }
  if (message === 'UNLIMITED_PRIZE_QUANTITY') {
    return Response.json({ error: '무제한 상품의 수량은 바꿀 수 없어요.' }, { status: 400, headers: API_HEADERS })
  }
  if (message.includes('LAST_ENABLED_PRIZE')) {
    return invalidInput('최소 한 종류의 경품은 지급 켬 상태여야 해요.')
  }
  if (message === 'INVALID_QUESTION_COUNT') {
    return invalidInput('퀴즈 문항 수는 3~5개로 설정해주세요.')
  }
  if (message.startsWith('INVALID_PRIZE_')) {
    return invalidInput('상품 정보를 확인해주세요.')
  }
  return unexpectedError(error, request)
}

async function getAdminState(db: D1Database): Promise<AdminBoothStateResponse> {
  const [inventory, settings] = await Promise.all([
    getPrizeInventory(db),
    getBoothSettings(db),
  ])
  return { ...inventory, settings }
}

function unexpectedError(error: unknown, request: Request): Response {
  console.error(
    JSON.stringify({
      message: 'admin prize request failed',
      error: error instanceof Error ? error.message : String(error),
      path: new URL(request.url).pathname,
    }),
  )
  return Response.json({ error: '경품 정보를 저장하지 못했어요.' }, { status: 500, headers: API_HEADERS })
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

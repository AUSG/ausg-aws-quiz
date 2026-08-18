import { isBoothSettingsResponse, type BoothSettingsResponse } from './booth-settings'

export type PrizeCode = string

export const MIN_PRIZE_WEIGHT = 1
export const MAX_PRIZE_WEIGHT = 100

export interface PrizeDisplayItem {
  readonly code: PrizeCode
  readonly label: string
  readonly color: string
}

/** 참가자 화면에 내려가는 공개 목록. 재고 수량은 의도적으로 포함하지 않는다. */
export interface PrizeCatalogResponse {
  readonly prizes: readonly PrizeDisplayItem[]
}

/** 운영자 화면과 서버 내부에서만 사용하는 재고 정보. */
export interface PrizeInventoryItem extends PrizeDisplayItem {
  /** 스티커처럼 무제한이면 null */
  readonly remaining: number | null
  readonly initialQuantity: number | null
  readonly unlimited: boolean
  /** 지급을 끄면 참가자 룰렛에서 숨기고 실제 추첨에서도 제외한다. */
  readonly enabled: boolean
  /** 활성·재고 보유 경품끼리 비교하는 상대 당첨 가중치. */
  readonly weight: number
}

export interface PrizeInventoryResponse {
  readonly prizes: readonly PrizeInventoryItem[]
  readonly totalWins: number
}

export interface AdminBoothStateResponse extends PrizeInventoryResponse {
  readonly settings: BoothSettingsResponse
}

export interface SpinRequest {
  readonly attemptId: string
  readonly score: number
  readonly total: number
  readonly elapsedMs: number
}

/** 공개 당첨 응답에도 남은 수량은 포함하지 않는다. */
export interface SpinResponse extends PrizeCatalogResponse {
  readonly prize: PrizeDisplayItem
  /** 동일 attemptId 재요청이면 새 차감 없이 기존 당첨을 돌려준다. */
  readonly replayed: boolean
}

export interface PrizeAwardResult extends PrizeInventoryResponse {
  readonly prize: PrizeInventoryItem
  readonly replayed: boolean
}

const PRIZE_CODE_PATTERN = /^[a-z0-9][a-z0-9-]{0,63}$/
const HEX_COLOR_PATTERN = /^#[0-9a-f]{6}$/i

export function isPrizeCode(value: string): value is PrizeCode {
  return PRIZE_CODE_PATTERN.test(value)
}

export function isPrizeCatalogResponse(value: unknown): value is PrizeCatalogResponse {
  return isRecord(value) && Array.isArray(value.prizes) && value.prizes.every(isPrizeDisplayItem)
}

export function isPrizeInventoryResponse(value: unknown): value is PrizeInventoryResponse {
  if (!isRecord(value) || !Array.isArray(value.prizes) || !isNonNegativeInteger(value.totalWins)) {
    return false
  }
  return value.prizes.every(isPrizeInventoryItem)
}

export function isAdminBoothStateResponse(value: unknown): value is AdminBoothStateResponse {
  return isPrizeInventoryResponse(value) && isRecord(value) && isBoothSettingsResponse(value.settings)
}

export function isSpinResponse(value: unknown): value is SpinResponse {
  return (
    isPrizeCatalogResponse(value) &&
    isRecord(value) &&
    isPrizeDisplayItem(value.prize) &&
    typeof value.replayed === 'boolean'
  )
}

function isPrizeDisplayItem(value: unknown): value is PrizeDisplayItem {
  if (!isRecord(value) || typeof value.code !== 'string' || !isPrizeCode(value.code)) return false
  return (
    typeof value.label === 'string' &&
    value.label.trim().length > 0 &&
    typeof value.color === 'string' &&
    HEX_COLOR_PATTERN.test(value.color)
  )
}

function isPrizeInventoryItem(value: unknown): value is PrizeInventoryItem {
  if (!isRecord(value)) return false
  const fields: Record<string, unknown> = value
  if (!isPrizeDisplayItem(value)) return false
  return (
    (isNonNegativeInteger(fields.remaining) || fields.remaining === null) &&
    (isNonNegativeInteger(fields.initialQuantity) || fields.initialQuantity === null) &&
    typeof fields.unlimited === 'boolean' &&
    typeof fields.enabled === 'boolean' &&
    typeof fields.weight === 'number' &&
    Number.isInteger(fields.weight) &&
    fields.weight >= MIN_PRIZE_WEIGHT &&
    fields.weight <= MAX_PRIZE_WEIGHT &&
    (fields.unlimited
      ? fields.remaining === null && fields.initialQuantity === null
      : fields.remaining !== null && fields.initialQuantity !== null)
  )
}

function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Card } from '../components/Card'
import {
  isAdminBoothStateResponse,
  MAX_PRIZE_WEIGHT,
  MIN_PRIZE_WEIGHT,
  type AdminBoothStateResponse,
  type PrizeInventoryItem,
} from '../lib/prizes'
import { MAX_QUESTION_COUNT, MIN_QUESTION_COUNT } from '../lib/booth-settings'

const ADMIN_PASSWORD = '2018'
const ADMIN_SESSION_KEY = 'ausg-quiz-admin-unlocked'
const ADMIN_API = '/api/admin/prizes'

export function AdminScreen() {
  const [unlocked, setUnlocked] = useState(() => readUnlockedSession())

  if (!unlocked) {
    return <AdminLogin onUnlock={() => setUnlocked(true)} />
  }

  return (
    <AdminDashboard
      onLogout={() => {
        sessionStorage.removeItem(ADMIN_SESSION_KEY)
        setUnlocked(false)
      }}
    />
  )
}

function AdminLogin({ onUnlock }: { readonly onUnlock: () => void }) {
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (password !== ADMIN_PASSWORD) {
      setError('비밀번호를 확인해주세요.')
      return
    }
    sessionStorage.setItem(ADMIN_SESSION_KEY, '1')
    onUnlock()
  }

  return (
    <Card className="mx-auto max-w-md py-8 text-center sm:py-10">
      <p className="text-sm font-extrabold tracking-wide text-codex-blue">BOOTH ADMIN</p>
      <h1 className="mt-2 text-3xl font-extrabold text-asb-dark">경품 관리자</h1>
      <p className="mt-3 text-sm text-asb-gray break-keep">
        행사 운영용 간단한 페이지입니다.
      </p>

      <form className="mt-7 text-left" onSubmit={submit}>
        <label htmlFor="admin-password" className="text-sm font-bold text-asb-dark">
          비밀번호
        </label>
        <input
          id="admin-password"
          type="password"
          inputMode="numeric"
          autoComplete="current-password"
          maxLength={4}
          autoFocus
          value={password}
          onChange={(event) => {
            setPassword(event.target.value)
            setError(null)
          }}
          className="mt-2 min-h-14 w-full select-text rounded-lg border-2 border-asb-border bg-white px-4 text-center text-2xl font-extrabold tracking-[0.35em] text-asb-dark focus:border-asb-blue"
        />
        {error ? <p role="alert" className="mt-2 text-sm font-bold text-red-700">{error}</p> : null}
        <button type="submit" className={`${buttonClass} mt-5 w-full bg-asb-orange text-black`}>
          들어가기
        </button>
      </form>
    </Card>
  )
}

function AdminDashboard({ onLogout }: { readonly onLogout: () => void }) {
  const [inventory, setInventory] = useState<AdminBoothStateResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [pendingAction, setPendingAction] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [label, setLabel] = useState('')
  const [quantity, setQuantity] = useState('0')
  const [color, setColor] = useState('#7c3aed')
  const [creating, setCreating] = useState(false)
  const [questionCountDraft, setQuestionCountDraft] = useState('3')

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setInventory(await requestInventory())
    } catch (caught) {
      setError(errorMessage(caught))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    if (inventory) setQuestionCountDraft(String(inventory.settings.questionCount))
  }, [inventory])

  const saveQuantity = async (code: string, remaining: number) => {
    setPendingAction(`${code}:quantity`)
    setError(null)
    setMessage(null)
    try {
      setInventory(
        await requestInventory({
          method: 'PATCH',
          body: JSON.stringify({ action: 'quantity', code, remaining }),
        }),
      )
      setMessage('남은 수량을 저장했어요.')
    } catch (caught) {
      setError(errorMessage(caught))
    } finally {
      setPendingAction(null)
    }
  }

  const saveDistribution = async (code: string, enabled: boolean, weight: number) => {
    setPendingAction(`${code}:distribution`)
    setError(null)
    setMessage(null)
    try {
      setInventory(
        await requestInventory({
          method: 'PATCH',
          body: JSON.stringify({ action: 'distribution', code, enabled, weight }),
        }),
      )
      setMessage('지급 여부와 당첨 가중치를 저장했어요.')
    } catch (caught) {
      setError(errorMessage(caught))
    } finally {
      setPendingAction(null)
    }
  }

  const saveQuestionCount = async () => {
    const questionCount = Number(questionCountDraft)
    if (
      !Number.isInteger(questionCount) ||
      questionCount < MIN_QUESTION_COUNT ||
      questionCount > MAX_QUESTION_COUNT
    ) {
      setError('퀴즈 문항 수는 3~5개로 설정해주세요.')
      return
    }

    setPendingAction('settings')
    setError(null)
    setMessage(null)
    try {
      setInventory(
        await requestInventory({
          method: 'PATCH',
          body: JSON.stringify({ action: 'settings', questionCount }),
        }),
      )
      setMessage(`퀴즈를 ${questionCount}문제로 설정했어요.`)
    } catch (caught) {
      setError(errorMessage(caught))
    } finally {
      setPendingAction(null)
    }
  }

  const create = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const parsedQuantity = Number(quantity)
    if (label.trim().length === 0 || !Number.isInteger(parsedQuantity) || parsedQuantity < 0) {
      setError('상품명과 시작 수량을 확인해주세요.')
      return
    }

    setCreating(true)
    setError(null)
    setMessage(null)
    try {
      setInventory(
        await requestInventory({
          method: 'POST',
          body: JSON.stringify({ label: label.trim(), quantity: parsedQuantity, color }),
        }),
      )
      setLabel('')
      setQuantity('0')
      setMessage('새 경품을 등록했어요.')
    } catch (caught) {
      setError(errorMessage(caught))
    } finally {
      setCreating(false)
    }
  }

  const hasAwardablePrize = inventory?.prizes.some(
    (prize) => prize.enabled && (prize.unlimited || (prize.remaining ?? 0) > 0),
  ) ?? true
  const totalAwardableWeight = inventory?.prizes.reduce(
    (sum, prize) =>
      sum + (prize.enabled && (prize.unlimited || (prize.remaining ?? 0) > 0) ? prize.weight : 0),
    0,
  ) ?? 0

  return (
    <Card className="h-full max-h-full overflow-y-auto">
      <div className="flex items-start justify-between gap-4 border-b border-asb-border-light pb-4">
        <div>
          <p className="text-sm font-extrabold tracking-wide text-codex-blue">BOOTH ADMIN</p>
          <h1 className="text-3xl font-extrabold text-asb-dark">부스 운영 관리</h1>
          <p className="mt-1 text-sm text-asb-gray">
            당첨 기록 {inventory?.totalWins ?? 0}건
          </p>
        </div>
        <button type="button" onClick={onLogout} className="rounded-lg border-2 border-asb-border px-3 py-2 text-sm font-bold text-asb-gray hover:bg-asb-callout">
          로그아웃
        </button>
      </div>

      {loading ? <p role="status" className="py-10 text-center font-bold text-asb-gray">경품 정보를 불러오는 중…</p> : null}

      {!loading && inventory ? (
        <>
          <section aria-labelledby="quiz-settings-heading" className="mt-5 rounded-xl border border-asb-border bg-asb-callout/40 p-4">
            <h2 id="quiz-settings-heading" className="text-xl font-extrabold text-asb-dark">퀴즈 설정</h2>
            <p className="mt-1 text-sm text-asb-gray">다음 참가자가 시작할 때부터 적용됩니다.</p>
            <div className="mt-3 flex flex-wrap items-end gap-3">
              <label className="text-sm font-bold text-asb-dark">
                출제 문항 수
                <select
                  aria-label="출제 문항 수"
                  value={questionCountDraft}
                  onChange={(event) => setQuestionCountDraft(event.target.value)}
                  className={`${inputClass} min-w-28`}
                >
                  {[3, 4, 5].map((count) => (
                    <option key={count} value={count}>{count}문제</option>
                  ))}
                </select>
              </label>
              <button
                type="button"
                disabled={pendingAction === 'settings'}
                onClick={() => void saveQuestionCount()}
                className={`${buttonClass} bg-asb-blue px-5 text-white`}
              >
                {pendingAction === 'settings' ? '저장 중…' : '문항 수 저장'}
              </button>
            </div>
          </section>

          <section aria-labelledby="inventory-heading" className="mt-7">
            <div className="flex items-end justify-between gap-3">
              <div>
                <h2 id="inventory-heading" className="text-xl font-extrabold text-asb-dark">등록된 경품</h2>
                <p className="mt-1 text-sm text-asb-gray">수량은 참가자 룰렛 화면에 표시되지 않습니다.</p>
                <p className="mt-1 text-sm text-asb-gray break-keep">
                  가중치는 재고가 있고 지급이 켜진 상품끼리 실제 추첨에 적용되며, 룰렛 칸 수와는 별개입니다.
                </p>
              </div>
              <button type="button" onClick={() => void load()} className="shrink-0 text-sm font-bold text-asb-blue underline underline-offset-4">
                새로고침
              </button>
            </div>

            {!hasAwardablePrize ? (
              <p role="alert" className="mt-3 rounded-lg bg-red-50 px-4 py-3 text-sm font-bold text-red-700">
                지금은 지급 가능한 경품이 없어 참가자가 룰렛을 돌릴 수 없습니다.
              </p>
            ) : null}

            <ul className="mt-4 grid gap-3 sm:grid-cols-2">
              {inventory.prizes.map((prize) => (
                <PrizeEditor
                  key={prize.code}
                  prize={prize}
                  totalAwardableWeight={totalAwardableWeight}
                  quantityPending={pendingAction === `${prize.code}:quantity`}
                  distributionPending={pendingAction === `${prize.code}:distribution`}
                  onSaveQuantity={saveQuantity}
                  onSaveDistribution={saveDistribution}
                />
              ))}
            </ul>
          </section>
        </>
      ) : null}

      <section aria-labelledby="new-prize-heading" className="mt-7 border-t border-asb-border-light pt-5">
        <h2 id="new-prize-heading" className="text-xl font-extrabold text-asb-dark">새 경품 등록</h2>
        <p className="mt-1 text-sm text-asb-gray">새 경품은 지급 켬·가중치 1로 등록됩니다. 수량이 0이면 룰렛에는 보이지만 당첨되지는 않습니다.</p>
        <form onSubmit={create} className="mt-4 grid gap-4 sm:grid-cols-[1fr_9rem_6rem_auto] sm:items-end">
          <label className="text-sm font-bold text-asb-dark">
            상품명
            <input
              required
              maxLength={30}
              value={label}
              onChange={(event) => setLabel(event.target.value)}
              className={inputClass}
              placeholder="예: 키링"
            />
          </label>
          <label className="text-sm font-bold text-asb-dark">
            시작 수량
            <input
              required
              type="number"
              inputMode="numeric"
              min={0}
              max={999}
              value={quantity}
              onChange={(event) => setQuantity(event.target.value)}
              className={inputClass}
            />
          </label>
          <label className="text-sm font-bold text-asb-dark">
            룰렛 색
            <input
              type="color"
              value={color}
              onChange={(event) => setColor(event.target.value)}
              className="mt-2 h-12 w-full cursor-pointer rounded-lg border-2 border-asb-border bg-white p-1"
            />
          </label>
          <button type="submit" disabled={creating} className={`${buttonClass} bg-asb-blue px-5 text-white`}>
            {creating ? '등록 중…' : '등록'}
          </button>
        </form>
      </section>

      {message ? <p role="status" className="mt-5 rounded-lg bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-800">{message}</p> : null}
      {error ? <p role="alert" className="mt-5 rounded-lg bg-red-50 px-4 py-3 text-sm font-bold text-red-700">{error}</p> : null}
    </Card>
  )
}

function PrizeEditor({
  prize,
  totalAwardableWeight,
  quantityPending,
  distributionPending,
  onSaveQuantity,
  onSaveDistribution,
}: {
  readonly prize: PrizeInventoryItem
  readonly totalAwardableWeight: number
  readonly quantityPending: boolean
  readonly distributionPending: boolean
  onSaveQuantity: (code: string, remaining: number) => Promise<void>
  onSaveDistribution: (code: string, enabled: boolean, weight: number) => Promise<void>
}) {
  const [quantityDraft, setQuantityDraft] = useState(String(prize.remaining ?? 0))
  const [weightDraft, setWeightDraft] = useState(String(prize.weight))
  const [enabledDraft, setEnabledDraft] = useState(prize.enabled)

  useEffect(() => {
    setQuantityDraft(String(prize.remaining ?? 0))
    setWeightDraft(String(prize.weight))
    setEnabledDraft(prize.enabled)
  }, [prize.enabled, prize.remaining, prize.weight])

  const parsedWeight = Number(weightDraft)
  const awardable = prize.unlimited || (prize.remaining ?? 0) > 0
  const otherAwardableWeight =
    totalAwardableWeight - (prize.enabled && awardable ? prize.weight : 0)
  const estimatedPercent =
    enabledDraft && awardable && Number.isInteger(parsedWeight) && parsedWeight > 0
      ? Math.round((parsedWeight / (otherAwardableWeight + parsedWeight)) * 100)
      : 0

  return (
    <li className={`rounded-xl border p-4 ${prize.enabled ? 'border-asb-border bg-asb-callout/40' : 'border-asb-border-light bg-white'}`}>
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <span aria-hidden="true" className="h-4 w-4 shrink-0 rounded-full border border-black/10" style={{ backgroundColor: prize.color }} />
          <h3 className="truncate font-extrabold text-asb-dark">{prize.label}</h3>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={enabledDraft}
          aria-label={`${prize.label} 지급 여부`}
          onClick={() => setEnabledDraft((current) => !current)}
          className={`min-h-11 shrink-0 rounded-full border-2 px-3 text-sm font-extrabold ${
            enabledDraft
              ? 'border-emerald-600 bg-emerald-50 text-emerald-800'
              : 'border-asb-border bg-asb-callout text-asb-gray'
          }`}
        >
          {enabledDraft ? '지급 켬' : '지급 끔'}
        </button>
      </div>

      <div className="mt-3 flex items-end gap-2">
        <label className="min-w-0 flex-1 text-xs font-bold text-asb-gray">
          당첨 가중치 · 예상 {estimatedPercent}%
          <input
            aria-label={`${prize.label} 당첨 가중치`}
            type="number"
            inputMode="numeric"
            min={MIN_PRIZE_WEIGHT}
            max={MAX_PRIZE_WEIGHT}
            value={weightDraft}
            onChange={(event) => setWeightDraft(event.target.value)}
            className={inputClass}
          />
        </label>
        <button
          type="button"
          disabled={distributionPending}
          onClick={() => {
            if (
              Number.isInteger(parsedWeight) &&
              parsedWeight >= MIN_PRIZE_WEIGHT &&
              parsedWeight <= MAX_PRIZE_WEIGHT
            ) {
              void onSaveDistribution(prize.code, enabledDraft, parsedWeight)
            }
          }}
          className={`${buttonClass} bg-white px-3 text-asb-blue`}
        >
          {distributionPending ? '저장 중…' : '지급·확률 저장'}
        </button>
      </div>

      {prize.unlimited ? (
        <p className="mt-3 rounded-lg bg-white px-3 py-3 text-center font-bold text-asb-gray">무제한 상품</p>
      ) : (
        <div className="mt-3 flex items-end gap-2">
          <label className="min-w-0 flex-1 text-xs font-bold text-asb-gray">
            남은 수량
            <input
              aria-label={`${prize.label} 남은 수량`}
              type="number"
              inputMode="numeric"
              min={0}
              max={999}
              value={quantityDraft}
              onChange={(event) => setQuantityDraft(event.target.value)}
              className={inputClass}
            />
          </label>
          <button
            type="button"
            disabled={quantityPending}
            onClick={() => {
              const value = Number(quantityDraft)
              if (Number.isInteger(value) && value >= 0 && value <= 999) {
                void onSaveQuantity(prize.code, value)
              }
            }}
            className={`${buttonClass} bg-white px-4 text-asb-blue`}
          >
            {quantityPending ? '저장 중…' : '수량 저장'}
          </button>
        </div>
      )}
    </li>
  )
}

async function requestInventory(init?: RequestInit): Promise<AdminBoothStateResponse> {
  const response = await fetch(ADMIN_API, {
    ...init,
    headers: {
      Accept: 'application/json',
      'X-Admin-Code': ADMIN_PASSWORD,
      ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
    },
  })
  const body: unknown = await response.json()
  if (!response.ok) throw new Error(readApiError(body))
  if (!isAdminBoothStateResponse(body)) throw new Error('서버 응답 형식이 올바르지 않아요.')
  return body
}

function readApiError(value: unknown): string {
  if (typeof value === 'object' && value !== null && 'error' in value && typeof value.error === 'string') {
    return value.error
  }
  return '경품 정보를 처리하지 못했어요.'
}

function errorMessage(value: unknown): string {
  return value instanceof Error ? value.message : '경품 정보를 처리하지 못했어요.'
}

function readUnlockedSession(): boolean {
  try {
    return sessionStorage.getItem(ADMIN_SESSION_KEY) === '1'
  } catch {
    return false
  }
}

const inputClass =
  'mt-2 h-12 w-full select-text rounded-lg border-2 border-asb-border bg-white px-3 text-base font-bold text-asb-dark focus:border-asb-blue'

const buttonClass =
  'inline-flex min-h-12 items-center justify-center rounded-lg border-2 border-current font-bold transition-colors disabled:cursor-not-allowed disabled:opacity-60'

import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { RouletteScreen } from '../screens/RouletteScreen'
import type { PrizeCatalogResponse, SpinRequest, SpinResponse } from '../lib/prizes'

const request: SpinRequest = {
  attemptId: '123e4567-e89b-42d3-a456-426614174000',
  score: 5,
  total: 5,
  elapsedMs: 30_000,
}

const catalog: PrizeCatalogResponse = {
  prizes: [
    { code: 'sticker', label: '스티커', color: '#2e49f5' },
    { code: 'tumbler', label: '텀블러', color: '#ff9900' },
    { code: 'cleaner', label: '클리너', color: '#0f9f6e' },
    { code: 'notebook', label: '노트', color: '#a0a2ff' },
  ],
}

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

function json(value: unknown, status = 200): Response {
  return new Response(JSON.stringify(value), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

describe('굿즈 룰렛', () => {
  it('상품별 반복 칸을 만들고 남은 수량은 표시하지 않는다', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(json(catalog)))

    render(<RouletteScreen request={request} onDone={() => undefined} />)

    expect(await screen.findByRole('button', { name: '룰렛 돌리기' })).toBeInTheDocument()
    expect(screen.getByRole('img')).toHaveAccessibleName('룰렛 상품: 스티커, 텀블러, 클리너, 노트')
    expect(screen.getAllByText('스티커')).toHaveLength(3)
    expect(screen.getAllByText('텀블러')).toHaveLength(3)
    expect(screen.queryByText(/\d+개|무제한|소진/)).not.toBeInTheDocument()
  })

  it('서버가 정한 상품의 여러 칸 중 하나에 멈추고 다음 참가자로 초기화한다', async () => {
    const user = userEvent.setup()
    const result: SpinResponse = {
      ...catalog,
      prize: catalog.prizes[1]!,
      replayed: false,
    }
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(json(catalog))
      .mockResolvedValueOnce(json(result))
    const done = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      callback(0)
      return 1
    })

    render(<RouletteScreen request={request} onDone={done} />)
    await user.click(await screen.findByRole('button', { name: '룰렛 돌리기' }))

    expect(await screen.findByRole('button', { name: '룰렛 도는 중…' })).toBeDisabled()
    expect(screen.getAllByText('텀블러')[0]?.closest('.opacity-0')).toBeNull()
    fireEvent.transitionEnd(screen.getByRole('img'), { propertyName: 'transform' })
    expect(await screen.findByText('텀블러 당첨')).toBeInTheDocument()
    expect(screen.queryByText(/19개|20개/)).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: '다음 참가자' }))
    expect(done).toHaveBeenCalledOnce()

    const post = fetchMock.mock.calls[1]
    expect(post?.[0]).toBe('/api/spin')
    expect(JSON.parse(String(post?.[1]?.body))).toEqual(request)
  })

  it('수량이 0인 상품도 공개 목록에 있으면 룰렛에서 반복해 보여준다', async () => {
    // 공개 목록에는 재고 숫자가 없으므로, 서버가 돌려준 등록 상품은 품절 여부와
    // 관계없이 모두 같은 방식으로 그려진다.
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(json(catalog)))

    render(<RouletteScreen request={request} onDone={() => undefined} />)

    await screen.findByRole('img')
    expect(screen.getAllByText('노트')).toHaveLength(3)
    expect(screen.getAllByText('클리너')).toHaveLength(3)
  })

  it('네트워크 오류 후 같은 시도를 다시 요청할 수 있다', async () => {
    const user = userEvent.setup()
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(json(catalog))
      .mockResolvedValueOnce(json({ error: '잠시 연결이 끊겼어요.' }, 500))
    vi.stubGlobal('fetch', fetchMock)

    render(<RouletteScreen request={request} onDone={() => undefined} />)
    await user.click(await screen.findByRole('button', { name: '룰렛 돌리기' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('잠시 연결이 끊겼어요.')
    expect(screen.getByRole('button', { name: '다시 돌리기' })).toBeEnabled()
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2))
  })
})

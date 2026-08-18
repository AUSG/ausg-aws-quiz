import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AdminScreen } from '../screens/AdminScreen'
import type { AdminBoothStateResponse } from '../lib/prizes'

const inventory: AdminBoothStateResponse = {
  totalWins: 3,
  settings: { questionCount: 3 },
  prizes: [
    {
      code: 'sticker',
      label: '스티커',
      color: '#2e49f5',
      remaining: null,
      initialQuantity: null,
      unlimited: true,
      enabled: true,
      weight: 1,
    },
    {
      code: 'tumbler',
      label: '텀블러',
      color: '#ff9900',
      remaining: 20,
      initialQuantity: 20,
      unlimited: false,
      enabled: true,
      weight: 1,
    },
  ],
}

afterEach(() => {
  cleanup()
  sessionStorage.clear()
  vi.unstubAllGlobals()
})

function json(value: unknown, status = 200): Response {
  return new Response(JSON.stringify(value), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

describe('/admin 경품 관리', () => {
  it('클라이언트 비밀번호 2018로 들어간다', async () => {
    const user = userEvent.setup()
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(json(inventory)))
    render(<AdminScreen />)

    await user.type(screen.getByLabelText('비밀번호'), '0000')
    await user.click(screen.getByRole('button', { name: '들어가기' }))
    expect(screen.getByRole('alert')).toHaveTextContent('비밀번호를 확인해주세요.')

    await user.clear(screen.getByLabelText('비밀번호'))
    await user.type(screen.getByLabelText('비밀번호'), '2018')
    await user.click(screen.getByRole('button', { name: '들어가기' }))

    expect(await screen.findByRole('heading', { name: '부스 운영 관리' })).toBeInTheDocument()
    expect(await screen.findByDisplayValue('20')).toBeInTheDocument()
    expect(screen.getByText('당첨 기록 3건')).toBeInTheDocument()
  })

  it('유한 상품의 남은 수량을 수정한다', async () => {
    const user = userEvent.setup()
    sessionStorage.setItem('ausg-quiz-admin-unlocked', '1')
    const updated: AdminBoothStateResponse = {
      ...inventory,
      prizes: inventory.prizes.map((prize) =>
        prize.code === 'tumbler' ? { ...prize, remaining: 7, initialQuantity: 7 } : prize,
      ),
    }
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(json(inventory))
      .mockResolvedValueOnce(json(updated))
    vi.stubGlobal('fetch', fetchMock)
    render(<AdminScreen />)

    const input = await screen.findByLabelText('텀블러 남은 수량')
    await user.clear(input)
    await user.type(input, '7')
    const row = screen.getByRole('heading', { name: '텀블러' }).closest('li')
    if (!row) throw new Error('텀블러 행을 찾을 수 없음')
    await user.click(within(row).getByRole('button', { name: '수량 저장' }))

    expect(await screen.findByRole('status')).toHaveTextContent('남은 수량을 저장했어요.')
    expect(fetchMock.mock.calls[1]?.[0]).toBe('/api/admin/prizes')
    expect(JSON.parse(String(fetchMock.mock.calls[1]?.[1]?.body))).toEqual({
      action: 'quantity',
      code: 'tumbler',
      remaining: 7,
    })
  })

  it('경품 지급 여부와 당첨 가중치를 수정한다', async () => {
    const user = userEvent.setup()
    sessionStorage.setItem('ausg-quiz-admin-unlocked', '1')
    const updated: AdminBoothStateResponse = {
      ...inventory,
      prizes: inventory.prizes.map((prize) =>
        prize.code === 'tumbler' ? { ...prize, enabled: false, weight: 4 } : prize,
      ),
    }
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(json(inventory))
      .mockResolvedValueOnce(json(updated))
    vi.stubGlobal('fetch', fetchMock)
    render(<AdminScreen />)

    const row = (await screen.findByRole('heading', { name: '텀블러' })).closest('li')
    if (!row) throw new Error('텀블러 행을 찾을 수 없음')
    await user.click(within(row).getByRole('switch', { name: '텀블러 지급 여부' }))
    const weight = within(row).getByLabelText('텀블러 당첨 가중치')
    await user.clear(weight)
    await user.type(weight, '4')
    await user.click(within(row).getByRole('button', { name: '지급·확률 저장' }))

    expect(JSON.parse(String(fetchMock.mock.calls[1]?.[1]?.body))).toEqual({
      action: 'distribution',
      code: 'tumbler',
      enabled: false,
      weight: 4,
    })
  })

  it('퀴즈 문항 수를 3~5개에서 선택한다', async () => {
    const user = userEvent.setup()
    sessionStorage.setItem('ausg-quiz-admin-unlocked', '1')
    const updated: AdminBoothStateResponse = {
      ...inventory,
      settings: { questionCount: 5 },
    }
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(json(inventory))
      .mockResolvedValueOnce(json(updated))
    vi.stubGlobal('fetch', fetchMock)
    render(<AdminScreen />)

    await user.selectOptions(await screen.findByLabelText('출제 문항 수'), '5')
    await user.click(screen.getByRole('button', { name: '문항 수 저장' }))

    expect(JSON.parse(String(fetchMock.mock.calls[1]?.[1]?.body))).toEqual({
      action: 'settings',
      questionCount: 5,
    })
  })

  it('새 경품과 시작 수량을 등록한다', async () => {
    const user = userEvent.setup()
    sessionStorage.setItem('ausg-quiz-admin-unlocked', '1')
    const updated: AdminBoothStateResponse = {
      ...inventory,
      prizes: [
        ...inventory.prizes,
        {
          code: 'custom-test',
          label: '키링',
          color: '#7c3aed',
          remaining: 5,
          initialQuantity: 5,
          unlimited: false,
          enabled: true,
          weight: 1,
        },
      ],
    }
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(json(inventory))
      .mockResolvedValueOnce(json(updated, 201))
    vi.stubGlobal('fetch', fetchMock)
    render(<AdminScreen />)

    await screen.findByRole('heading', { name: '새 경품 등록' })
    await user.type(screen.getByLabelText('상품명'), '키링')
    await user.clear(screen.getByLabelText('시작 수량'))
    await user.type(screen.getByLabelText('시작 수량'), '5')
    await user.click(screen.getByRole('button', { name: '등록' }))

    expect(await screen.findByRole('heading', { name: '키링' })).toBeInTheDocument()
    expect(fetchMock.mock.calls[1]?.[1]?.method).toBe('POST')
  })
})

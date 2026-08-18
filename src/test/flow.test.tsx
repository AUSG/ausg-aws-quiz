import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { App } from '../App'
import { questions } from '../data/questions'
import { SESSION } from '../config'

function json(value: unknown): Response {
  return new Response(JSON.stringify(value), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
}

beforeEach(() => {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue(json({ questionCount: SESSION.questionCount })),
  )
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

function optionGroup(): HTMLElement {
  return screen.getByRole('group', { name: '보기' })
}

/** 화면에 뜬 문제를 문제 은행에서 찾아 정답 보기의 텍스트를 알아낸다. */
function currentQuestion() {
  const heading = screen.getByRole('heading', { level: 1 })
  const found = questions.find((q) => q.prompt === heading.textContent)
  if (!found) throw new Error(`문제 은행에 없는 문제: ${heading.textContent}`)
  return found
}

/** correct=true면 정답을, false면 오답을 고른다. */
async function answerCurrent(user: ReturnType<typeof userEvent.setup>, correct: boolean) {
  const question = currentQuestion()
  const index = correct
    ? question.answerIndex
    : (question.answerIndex + 1) % question.options.length
  const text = question.options[index]
  if (text === undefined) throw new Error('보기를 찾을 수 없음')
  // 보기 텍스트에 정규식 메타문자가 들어간다(예: "다중 인증(MFA)").
  // getByRole의 name은 문자열을 주면 완전 일치이므로 정규식을 쓰지 않는다.
  await user.click(within(optionGroup()).getByRole('button', { name: text }))
}

async function playThrough(
  user: ReturnType<typeof userEvent.setup>,
  correctCount: number,
  total = SESSION.questionCount,
) {
  for (let i = 0; i < total; i++) {
    await answerCurrent(user, i < correctCount)
    const isLast = i === total - 1
    await user.click(screen.getByRole('button', { name: isLast ? '결과 보기' : '다음 문제' }))
  }
}

describe('부스 퀴즈 한 바퀴', () => {
  it('기본 높은 점수 배너 기준은 3문제 전부 정답이다', () => {
    expect(SESSION.questionCount).toBe(3)
    expect(SESSION.prizeThreshold).toBe(SESSION.questionCount)
  })

  it('시작 화면에 행사명, Codex 제작 안내, 소요시간을 보여준다', async () => {
    render(<App />)
    await screen.findByRole('button', { name: '시작하기' })
    expect(screen.getByRole('heading', { name: 'AUSG × AWSKRUG 퀴즈' })).toBeInTheDocument()
    expect(screen.getByText('Codex Community Hackathon')).toBeInTheDocument()
    expect(screen.getByText('Seoul for Students')).toBeInTheDocument()
    expect(screen.getByText('이 퀴즈는 Codex로 만들었어요.')).toBeInTheDocument()
    expect(screen.getByText(new RegExp(`${SESSION.questionCount}문제`))).toBeInTheDocument()
    expect(screen.getByText(/퀴즈를 풀고 굿즈 룰렛/)).toBeInTheDocument()
  })

  it('관리자가 저장한 5문제 설정으로 한 세션을 진행한다', async () => {
    const user = userEvent.setup()
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(json({ questionCount: 5 })))
    render(<App />)

    await user.click(await screen.findByRole('button', { name: '시작하기' }))
    expect(screen.getByRole('progressbar', { name: '총 5문제 중 1번째' })).toBeInTheDocument()
    await playThrough(user, 5, 5)
    expect(screen.getByText('5문제 중 5문제 정답!')).toBeInTheDocument()
  })

  it('전부 맞히면 상품 배너가 뜬다', async () => {
    const user = userEvent.setup()
    render(<App />)
    await user.click(await screen.findByRole('button', { name: '시작하기' }))
    await playThrough(user, SESSION.questionCount)

    const n = SESSION.questionCount
    expect(screen.getByText(`${n}문제 중 ${n}문제 정답!`)).toBeInTheDocument()
    expect(screen.getByText(/룰렛 기회 획득/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '굿즈 룰렛 돌리기' })).toBeInTheDocument()
  })

  it('하나라도 틀려도 룰렛 버튼은 보인다', async () => {
    const user = userEvent.setup()
    render(<App />)
    await user.click(await screen.findByRole('button', { name: '시작하기' }))
    await playThrough(user, SESSION.questionCount - 1)

    const n = SESSION.questionCount
    expect(screen.getByText(`${n}문제 중 ${n - 1}문제 정답!`)).toBeInTheDocument()
    expect(screen.getByText(/퀴즈 완료/)).toBeInTheDocument()
    expect(screen.queryByText(/룰렛 기회 획득/)).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: '굿즈 룰렛 돌리기' })).toBeInTheDocument()
  })

  it('하나도 못 맞혀도 안내 문구가 나온다', async () => {
    const user = userEvent.setup()
    render(<App />)
    await user.click(await screen.findByRole('button', { name: '시작하기' }))
    await playThrough(user, 0)

    expect(screen.getByText(`${SESSION.questionCount}문제 중 0문제 정답!`)).toBeInTheDocument()
    expect(screen.getByText(/퀴즈 완료/)).toBeInTheDocument()
    expect(screen.queryByText(/룰렛 기회 획득/)).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: '굿즈 룰렛 돌리기' })).toBeInTheDocument()
  })

  it('제출 버튼 없이 보기를 누르면 바로 채점된다', async () => {
    const user = userEvent.setup()
    render(<App />)
    await user.click(await screen.findByRole('button', { name: '시작하기' }))

    expect(screen.queryByRole('button', { name: '제출하기' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '다음 문제' })).not.toBeInTheDocument()

    await answerCurrent(user, true)

    expect(screen.getByText(/정답이에요/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '다음 문제' })).toBeInTheDocument()
  })

  it('틀려도 정답과 해설을 보여준다', async () => {
    const user = userEvent.setup()
    render(<App />)
    await user.click(await screen.findByRole('button', { name: '시작하기' }))

    const question = currentQuestion()
    await answerCurrent(user, false)

    expect(screen.getByText(/아쉬워요/)).toBeInTheDocument()
    expect(screen.getByText(question.explanation)).toBeInTheDocument()
  })

  it('정답 공개 후에는 보기를 다시 누를 수 없다 (연타 방지)', async () => {
    const user = userEvent.setup()
    render(<App />)
    await user.click(await screen.findByRole('button', { name: '시작하기' }))
    await answerCurrent(user, true)

    for (const button of within(optionGroup()).getAllByRole('button')) {
      expect(button).toBeDisabled()
    }
  })

  it('1번 문제는 항상 가장 쉬운 난이도로 나온다', async () => {
    const user = userEvent.setup()
    for (let attempt = 0; attempt < 20; attempt++) {
      render(<App />)
      await user.click(await screen.findByRole('button', { name: '시작하기' }))
      expect(currentQuestion().difficulty).toBe(1)
      cleanup()
    }
  })

  it('낮은 점수여도 결과 화면에서 룰렛으로 이동한다', async () => {
    const user = userEvent.setup()
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce(json({ questionCount: SESSION.questionCount }))
        .mockResolvedValueOnce(
          json({
            prizes: [
              { code: 'sticker', label: '스티커', color: '#2e49f5' },
              { code: 'tumbler', label: '텀블러', color: '#ff9900' },
            ],
          }),
        ),
    )
    render(<App />)
    await user.click(await screen.findByRole('button', { name: '시작하기' }))
    await playThrough(user, SESSION.questionCount - 1)
    await user.click(screen.getByRole('button', { name: '굿즈 룰렛 돌리기' }))

    expect(await screen.findByRole('heading', { name: '굿즈 룰렛' })).toBeInTheDocument()
    expect(await screen.findByRole('button', { name: '룰렛 돌리기' })).toBeInTheDocument()
  })

  it('정답 다시 보기로 문항별 복습을 펼친다', async () => {
    const user = userEvent.setup()
    render(<App />)
    await user.click(await screen.findByRole('button', { name: '시작하기' }))
    await playThrough(user, SESSION.questionCount)

    const toggle = screen.getByRole('button', { name: '정답 다시 보기' })
    expect(toggle).toHaveAttribute('aria-expanded', 'false')
    await user.click(toggle)
    expect(screen.getByRole('button', { name: '정답 접기' })).toHaveAttribute(
      'aria-expanded',
      'true',
    )
  })
})

describe('무입력 자동 리셋', () => {
  // userEvent는 가짜 타이머와 잘 맞지 않아 여기서만 fireEvent를 쓴다.
  it('방치하면 시작 화면으로 돌아간다', async () => {
    vi.useFakeTimers()
    try {
      render(<App />)
      await act(async () => undefined)
      fireEvent.click(screen.getByRole('button', { name: '시작하기' }))
      expect(screen.getByRole('group', { name: '보기' })).toBeInTheDocument()

      await act(async () => {
        vi.advanceTimersByTime(SESSION.idleResetMs + 1000)
        await Promise.resolve()
      })

      expect(screen.getByRole('button', { name: '시작하기' })).toBeInTheDocument()
      expect(screen.queryByRole('group', { name: '보기' })).not.toBeInTheDocument()
    } finally {
      vi.useRealTimers()
    }
  })

  it('시작 화면에서는 리셋 타이머가 돌지 않는다', async () => {
    vi.useFakeTimers()
    try {
      render(<App />)
      await act(async () => undefined)
      act(() => {
        vi.advanceTimersByTime(SESSION.idleResetMs * 3)
      })
      expect(screen.getByRole('button', { name: '시작하기' })).toBeInTheDocument()
    } finally {
      vi.useRealTimers()
    }
  })
})

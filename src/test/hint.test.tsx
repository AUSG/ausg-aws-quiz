import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { App } from '../App'
import { questions } from '../data/questions'
import { SESSION } from '../config'

beforeEach(() => {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ questionCount: SESSION.questionCount }), {
        headers: { 'Content-Type': 'application/json' },
      }),
    ),
  )
})

afterEach(() => {
  cleanup()
  window.history.replaceState({}, '', '/')
  vi.unstubAllGlobals()
})

const HINT_BUTTON = 'Codex 힌트 보기'
const LOADING_BUTTON = /생각하는 중/

/**
 * 이 환경에서는 가짜 타이머를 켜면 Testing Library가 멈춘다(setTimeout 하나만
 * 페이크해도 재현된다). 그래서 지연 자체를 `?hint=` 로 끌 수 있게 해두고,
 * 지연과 무관한 검사는 전부 `?hint=0` 에서 즉시 돌린다.
 * 지연 동작 자체는 아래 별도 describe에서 진짜 시계로 확인한다.
 */
function renderApp(search = '?hint=0') {
  window.history.replaceState({}, '', search)
  return render(<App />)
}

function currentQuestion() {
  const heading = screen.getByRole('heading', { level: 1 })
  const found = questions.find((q) => q.prompt === heading.textContent)
  if (!found) throw new Error(`문제 은행에 없는 문제: ${heading.textContent}`)
  return found
}

async function start(user: ReturnType<typeof userEvent.setup>, search?: string) {
  renderApp(search)
  await user.click(await screen.findByRole('button', { name: '시작하기' }))
}

async function answerCurrent(user: ReturnType<typeof userEvent.setup>, correct: boolean) {
  const question = currentQuestion()
  const index = correct
    ? question.answerIndex
    : (question.answerIndex + 1) % question.options.length
  const text = question.options[index]
  if (text === undefined) throw new Error('보기를 찾을 수 없음')
  const group = screen.getByRole('group', { name: '보기' })
  await user.click(within(group).getByRole('button', { name: text }))
}

describe('힌트', () => {
  it('정답 공개 전에는 힌트 버튼이 있다', async () => {
    const user = userEvent.setup()
    await start(user)
    expect(screen.getByRole('button', { name: HINT_BUTTON })).toBeInTheDocument()
  })

  it('누르면 그 문제의 힌트가 나온다', async () => {
    const user = userEvent.setup()
    await start(user)
    const question = currentQuestion()

    expect(screen.queryByText(question.hint)).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: HINT_BUTTON }))
    expect(screen.getByText(question.hint)).toBeInTheDocument()
  })

  // 부스 태블릿에서 두 번째 탭은 낭비이고 오조작 기회다. 되돌리는 토글이 없어야 한다.
  it('한 번 열면 버튼이 사라진다 (토글 아님)', async () => {
    const user = userEvent.setup()
    await start(user)
    await user.click(screen.getByRole('button', { name: HINT_BUTTON }))
    expect(screen.queryByRole('button', { name: HINT_BUTTON })).not.toBeInTheDocument()
  })

  it('정답이 공개되면 힌트 버튼이 사라진다', async () => {
    const user = userEvent.setup()
    await start(user)
    await answerCurrent(user, true)
    expect(screen.queryByRole('button', { name: HINT_BUTTON })).not.toBeInTheDocument()
  })

  it('다음 문제로 넘어가면 힌트가 닫힌 상태로 시작한다', async () => {
    const user = userEvent.setup()
    await start(user)

    const first = currentQuestion()
    await user.click(screen.getByRole('button', { name: HINT_BUTTON }))
    expect(screen.getByText(first.hint)).toBeInTheDocument()

    await answerCurrent(user, true)
    await user.click(screen.getByRole('button', { name: '다음 문제' }))

    // 2번 문제가 1번 문제의 힌트를 띄운 채로 열리면 안 된다
    expect(screen.queryByText(first.hint)).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: HINT_BUTTON })).toBeInTheDocument()
  })

  it('스크린리더가 힌트 등장을 읽도록 라이브 리전에 들어간다', async () => {
    const user = userEvent.setup()
    await start(user)
    const live = screen.getAllByRole('status')
    expect(live.length).toBeGreaterThan(0)

    await user.click(screen.getByRole('button', { name: HINT_BUTTON }))
    const question = currentQuestion()
    const hintNode = screen.getByText(question.hint)
    expect(hintNode.closest('[aria-live="polite"]')).not.toBeNull()
  })

  // 부스는 시험이 아니라 미끼다. 힌트를 벌주면 아무도 안 누르고, 그러면 만든 의미가 없다.
  it('힌트를 써도 상품 자격에 영향이 없다', async () => {
    const user = userEvent.setup()
    await start(user)

    for (let i = 0; i < SESSION.questionCount; i++) {
      await user.click(screen.getByRole('button', { name: HINT_BUTTON }))
      await answerCurrent(user, true)
      const isLast = i === SESSION.questionCount - 1
      await user.click(screen.getByRole('button', { name: isLast ? '결과 보기' : '다음 문제' }))
    }

    expect(screen.getByText(/룰렛 기회 획득/)).toBeInTheDocument()
    // 힌트 사용 흔적을 결과 화면에 남기지 않는다
    expect(screen.queryByText(/힌트/)).not.toBeInTheDocument()
  })

  it('모든 문항에 힌트가 있고 정답을 그대로 말하지 않는다', () => {
    for (const question of questions) {
      expect(question.hint.trim().length).toBeGreaterThan(0)
      if (question.format === 'choice') {
        const answer = question.options[question.answerIndex]
        expect(answer).toBeDefined()
        expect(question.hint).not.toContain(answer as string)
      }
    }
  })
})

// 여기만 진짜 시계로 돈다. 느리지만 지연은 이 앱의 눈에 보이는 동작이라
// 어딘가 한 곳에서는 실제로 기다려 봐야 한다.
describe('힌트 공개 지연', () => {
  it('기본 설정에서는 누른 뒤 잠시 뒤에 뜬다', async () => {
    const user = userEvent.setup()
    await start(user, '/')
    const question = currentQuestion()

    await user.click(screen.getByRole('button', { name: HINT_BUTTON }))

    // 누른 직후: 아직 힌트는 없고 준비 중 표시만 있다
    expect(screen.queryByText(question.hint)).not.toBeInTheDocument()
    const loading = screen.getByRole('button', { name: LOADING_BUTTON })
    expect(loading).toBeDisabled()
    expect(loading).toHaveAttribute('aria-busy', 'true')

    await screen.findByText(question.hint, {}, { timeout: SESSION.hintDelayMs + 2000 })
    expect(screen.queryByRole('button', { name: LOADING_BUTTON })).not.toBeInTheDocument()
  })

  it('?hint=0 이면 지연도 준비 중 표시도 없다', async () => {
    const user = userEvent.setup()
    await start(user, '?hint=0')
    const question = currentQuestion()

    await user.click(screen.getByRole('button', { name: HINT_BUTTON }))
    expect(screen.getByText(question.hint)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: LOADING_BUTTON })).not.toBeInTheDocument()
  })

  // 지연이 생기면서 새로 가능해진 사고: 앞 문제의 타이머가 뒤늦게 터지는 것.
  it('준비 중에 다음 문제로 넘어가면 앞 문제 힌트가 뒤늦게 뜨지 않는다', async () => {
    const user = userEvent.setup()
    await start(user, '/')

    const first = currentQuestion()
    await user.click(screen.getByRole('button', { name: HINT_BUTTON }))
    await answerCurrent(user, true)
    await user.click(screen.getByRole('button', { name: '다음 문제' }))

    await new Promise((resolve) => setTimeout(resolve, SESSION.hintDelayMs + 300))

    expect(screen.queryByText(first.hint)).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: HINT_BUTTON })).toBeInTheDocument()
  })
})

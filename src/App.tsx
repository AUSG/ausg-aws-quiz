import { useCallback, useEffect, useMemo, useState } from 'react'
import { questions } from './data/questions'
import { readBoothConfig, SESSION } from './config'
import { useIdleReset } from './hooks/useIdleReset'
import { useQuiz } from './state/useQuiz'
import { QuizScreen } from './screens/QuizScreen'
import { ResultScreen } from './screens/ResultScreen'
import { StartScreen } from './screens/StartScreen'
import { RouletteScreen } from './screens/RouletteScreen'
import { AdminScreen } from './screens/AdminScreen'
import type { SpinRequest } from './lib/prizes'
import { isBoothSettingsResponse } from './lib/booth-settings'
import { Card } from './components/Card'

/**
 * 상태는 전부 여기서만 산다. 네 화면은 props만 받는 표현 컴포넌트라
 * 테스트에서 단독으로 렌더할 수 있다.
 */
export function App() {
  const admin = isAdminPath(window.location.pathname)

  return (
    <main
      className={`flex min-h-0 w-full flex-1 p-3 short:p-2 sm:p-6 ${
        admin ? 'items-stretch justify-center' : 'items-center justify-center'
      }`}
    >
      <div
        className={`flex h-full max-h-full w-full flex-col ${
          admin ? 'max-w-[56rem]' : 'max-w-[34rem] justify-center'
        }`}
      >
        {admin ? <AdminScreen /> : <QuizApp />}
      </div>
    </main>
  )
}

function QuizApp() {
  const search = useMemo(() => window.location.search, [])
  const [persistedQuestionCount, setPersistedQuestionCount] = useState(SESSION.questionCount)
  const [settingsLoading, setSettingsLoading] = useState(true)

  const refreshSettings = useCallback(async () => {
    setSettingsLoading(true)
    try {
      const response = await fetch('/api/config', { headers: { Accept: 'application/json' } })
      const body: unknown = await response.json()
      if (!response.ok || !isBoothSettingsResponse(body)) {
        throw new Error('INVALID_BOOTH_SETTINGS')
      }
      setPersistedQuestionCount(body.questionCount)
    } catch {
      // 네트워크가 잠깐 끊겨도 부스 자체는 기본 3문제로 계속 운영한다.
      setPersistedQuestionCount(SESSION.questionCount)
    } finally {
      setSettingsLoading(false)
    }
  }, [])

  useEffect(() => {
    void refreshSettings()
  }, [refreshSettings])

  const config = useMemo(
    () => readBoothConfig(search, persistedQuestionCount),
    [persistedQuestionCount, search],
  )
  const quiz = useQuiz(questions, { count: config.questionCount })
  const [rouletteRequest, setRouletteRequest] = useState<SpinRequest | null>(null)

  const resetForNextVisitor = useCallback(() => {
    setRouletteRequest(null)
    quiz.reset()
    void refreshSettings()
  }, [quiz.reset, refreshSettings])

  useIdleReset(
    config.kiosk && (quiz.phase !== 'idle' || rouletteRequest !== null),
    config.idleResetMs,
    resetForNextVisitor,
  )

  const openRoulette = useCallback(() => {
    setRouletteRequest({
      attemptId: crypto.randomUUID(),
      score: quiz.score,
      total: quiz.total,
      elapsedMs: quiz.elapsedMs,
    })
  }, [quiz.elapsedMs, quiz.score, quiz.total])

  return (
    <>
      {rouletteRequest !== null ? (
        <RouletteScreen request={rouletteRequest} onDone={resetForNextVisitor} />
      ) : null}

      {rouletteRequest === null && quiz.phase === 'idle' && settingsLoading ? (
        <Card className="items-center py-12 text-center">
          <p role="status" className="font-bold text-asb-gray">퀴즈 설정을 불러오는 중…</p>
        </Card>
      ) : null}

      {rouletteRequest === null && quiz.phase === 'idle' && !settingsLoading ? (
        <StartScreen total={config.questionCount} onStart={quiz.start} />
      ) : null}

      {rouletteRequest === null && quiz.phase === 'playing' && quiz.question !== null ? (
        <QuizScreen
          question={quiz.question}
          index={quiz.index}
          total={quiz.total}
          selected={quiz.selected}
          revealed={quiz.revealed}
          isLast={quiz.isLast}
          hintDelayMs={config.hintDelayMs}
          onAnswer={quiz.answer}
          onNext={quiz.next}
        />
      ) : null}

      {rouletteRequest === null && quiz.phase === 'done' ? (
        <ResultScreen
          score={quiz.score}
          total={quiz.total}
          results={quiz.results}
          prizeThreshold={config.prizeThreshold}
          onSpin={openRoulette}
        />
      ) : null}
    </>
  )
}

function isAdminPath(pathname: string): boolean {
  return pathname.replace(/\/+$/, '') === '/admin'
}

export default App

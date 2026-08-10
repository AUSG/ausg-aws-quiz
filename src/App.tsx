import { useMemo } from 'react'
import { questions } from './data/questions'
import { readBoothConfig } from './config'
import { useIdleReset } from './hooks/useIdleReset'
import { useQuiz } from './state/useQuiz'
import { QuizScreen } from './screens/QuizScreen'
import { ResultScreen } from './screens/ResultScreen'
import { StartScreen } from './screens/StartScreen'

/**
 * 상태는 전부 여기서만 산다. 세 화면은 props만 받는 순수 표현 컴포넌트라
 * 테스트에서 단독으로 렌더할 수 있다.
 */
export function App() {
  const config = useMemo(() => readBoothConfig(window.location.search), [])
  const quiz = useQuiz(questions, { count: config.questionCount })

  useIdleReset(config.kiosk && quiz.phase !== 'idle', config.idleResetMs, quiz.reset)

  return (
    <main className="flex min-h-0 w-full flex-1 items-center justify-center p-3 short:p-2 sm:p-6">
      <div className="flex h-full max-h-full w-full max-w-[34rem] flex-col justify-center">
        {quiz.phase === 'idle' ? (
          <StartScreen total={config.questionCount} onStart={quiz.start} />
        ) : null}

        {quiz.phase === 'playing' && quiz.question !== null ? (
          <QuizScreen
            question={quiz.question}
            index={quiz.index}
            total={quiz.total}
            selected={quiz.selected}
            revealed={quiz.revealed}
            isLast={quiz.isLast}
            onAnswer={quiz.answer}
            onNext={quiz.next}
          />
        ) : null}

        {quiz.phase === 'done' ? (
          <ResultScreen
            score={quiz.score}
            total={quiz.total}
            results={quiz.results}
            prizeThreshold={config.prizeThreshold}
            onRestart={quiz.start}
          />
        ) : null}
      </div>
    </main>
  )
}

export default App

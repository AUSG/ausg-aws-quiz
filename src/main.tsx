import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import './index.css'
import App from './App'

// 이전 서비스 워커가 HTML을 잡고 있어 배포가 안 된 것처럼 보이지 않도록,
// 새 버전이 활성화되는 즉시 현재 페이지를 한 번 새로 불러온다.
registerSW({ immediate: true })

const container = document.getElementById('root')

if (!container) {
  throw new Error('#root 엘리먼트를 찾을 수 없습니다.')
}

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

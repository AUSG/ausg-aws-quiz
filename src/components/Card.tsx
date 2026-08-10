import type { ReactNode } from 'react'

interface CardProps {
  readonly children: ReactNode
  readonly className?: string
}

/**
 * 어두운 네이비 배경 위에 올라가는 흰 카드.
 * 전시장 조명 아래에서도 경계가 보이도록 그림자를 세게 준다.
 */
export function Card({ children, className = '' }: CardProps) {
  return (
    <div
      className={`flex min-h-0 w-full flex-col rounded-3xl bg-white p-5 shadow-[0_20px_50px_-12px_rgba(0,0,0,0.65)] sm:p-7 ${className}`}
    >
      {children}
    </div>
  )
}

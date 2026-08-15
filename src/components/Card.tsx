import type { ReactNode } from 'react'

interface CardProps {
  readonly children: ReactNode
  readonly className?: string
}

/**
 * 밝은 #fafafa 페이지 위에 놓이는 흰 패널.
 *
 * AWS Skill Builder 디자인 시스템의 `.asb-module-panel`을 그대로 옮겼다.
 * 1px 테두리, 12px 반경, 아주 평평한 그림자 하나.
 * 페이지 위에 떠 있는 카드가 아니라 문서의 한 구획처럼 읽혀야 한다.
 */
const BASE =
  'flex min-h-0 w-full flex-col rounded-xl border border-asb-border bg-white' +
  ' shadow-[0_1px_4px_rgba(0,0,0,0.06)] p-5 short:p-3.5 sm:p-6'

export function Card({ children, className = '' }: CardProps) {
  return <div className={`${BASE} ${className}`}>{children}</div>
}

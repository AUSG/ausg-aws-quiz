import type { ReactNode } from 'react'

interface CardProps {
  readonly children: ReactNode
  readonly className?: string
}

/**
 * White panel on the light #fafafa page.
 *
 * Mirrors `.asb-module-panel` from the AWS Skill Builder design system:
 * 1px border, 12px radius, one very flat shadow. It should read as a
 * documentation panel, not as a card floating above the page.
 */
const BASE =
  'flex min-h-0 w-full flex-col rounded-xl border border-asb-border bg-white' +
  ' shadow-[0_1px_4px_rgba(0,0,0,0.06)] p-5 short:p-3.5 sm:p-6'

export function Card({ children, className = '' }: CardProps) {
  return <div className={`${BASE} ${className}`}>{children}</div>
}

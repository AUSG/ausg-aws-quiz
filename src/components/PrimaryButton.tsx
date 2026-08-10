import type { ReactNode } from 'react'

export type ButtonVariant = 'primary' | 'secondary'

interface PrimaryButtonProps {
  readonly children: ReactNode
  readonly variant?: ButtonVariant
  readonly disabled?: boolean
  readonly className?: string
  /** 보이는 텍스트가 이모지뿐일 때만 사용 */
  readonly ariaLabel?: string
  readonly ariaExpanded?: boolean
  readonly ariaControls?: string
  onClick: () => void
}

const BASE =
  'inline-flex w-full items-center justify-center gap-2 rounded-2xl px-5 text-center font-black' +
  ' transition-[background-color,border-color,transform] duration-150 ease-out' +
  ' disabled:cursor-not-allowed disabled:opacity-60'

const VARIANTS: Record<ButtonVariant, string> = {
  primary:
    'min-h-14 text-xl bg-aws-orange text-aws-navy shadow-lg shadow-aws-orange/30' +
    ' hover:bg-[#ffab2e] active:translate-y-px focus-visible:outline-aws-navy sm:min-h-16 sm:text-2xl',
  secondary:
    'min-h-14 text-lg border-2 border-aws-navy/25 bg-white text-aws-navy' +
    ' hover:bg-aws-navy/5 active:translate-y-px',
}

export function PrimaryButton({
  children,
  variant = 'primary',
  disabled = false,
  className = '',
  ariaLabel,
  ariaExpanded,
  ariaControls,
  onClick,
}: PrimaryButtonProps) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      aria-label={ariaLabel}
      aria-expanded={ariaExpanded}
      aria-controls={ariaControls}
      className={`${BASE} ${VARIANTS[variant]} ${className}`}
    >
      {children}
    </button>
  )
}

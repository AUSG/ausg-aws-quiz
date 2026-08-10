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

/* Reference `.asb-btn`: 8px radius, 2px border, weight 700.
   The primary variant is orange with BLACK label text (contrast 9.8:1) —
   that black-on-orange pairing is the signature of the design system. */
const BASE =
  'inline-flex w-full items-center justify-center gap-2 rounded-lg border-2 px-5 text-center font-bold' +
  ' transition-[background-color,border-color] duration-150 ease-out' +
  ' disabled:cursor-not-allowed disabled:opacity-60'

const SIZING = 'min-h-14 short:min-h-12 sm:min-h-16'

const VARIANTS: Record<ButtonVariant, string> = {
  primary:
    `${SIZING} text-xl border-asb-orange bg-asb-orange text-black shadow-[0_1px_2px_rgba(0,0,0,0.1)]` +
    ' hover:border-asb-orange-hover hover:bg-asb-orange-hover hover:shadow-[0_2px_4px_rgba(0,0,0,0.15)]' +
    ' short:text-lg sm:text-2xl',
  secondary: `${SIZING} text-lg border-asb-blue bg-white text-asb-blue hover:bg-asb-blue/10`,
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

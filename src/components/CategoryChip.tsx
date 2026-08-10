import type { Category } from '../data/types'

interface CategoryChipProps {
  readonly category: Category
  readonly className?: string
}

export function CategoryChip({ category, className = '' }: CategoryChipProps) {
  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-md border border-asb-blue/30 bg-asb-blue/10 px-2.5 py-1 text-sm font-bold text-asb-blue ${className}`}
    >
      {category}
    </span>
  )
}

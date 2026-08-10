import type { Category } from '../data/types'

interface CategoryChipProps {
  readonly category: Category
  readonly className?: string
}

export function CategoryChip({ category, className = '' }: CategoryChipProps) {
  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-full bg-aws-navy/10 px-3 py-1 text-sm font-bold text-aws-navy ${className}`}
    >
      {category}
    </span>
  )
}

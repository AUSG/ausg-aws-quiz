import type { Category } from '../data/types'

interface CategoryChipProps {
  readonly category: Category
  readonly className?: string
}

export function CategoryChip({ category, className = '' }: CategoryChipProps) {
  return (
    <span
      /* 파란 톤이 아니라 흰 배경이다. #0073bb를 10% 파란 워시 위에 올리면 4.39:1이고
         14px 볼드는 '큰 텍스트'로 쳐주지 않는다. 흰 배경에서는 5.03:1이다. */
      className={`inline-flex shrink-0 items-center rounded-md border border-asb-blue/40 bg-white px-2.5 py-1 text-sm font-bold text-asb-blue ${className}`}
    >
      {category}
    </span>
  )
}

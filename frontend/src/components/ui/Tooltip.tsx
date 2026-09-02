import type { ReactNode } from 'react'

import { cn } from '@/lib/cn'

/**
 * CSS-only hover label. Not a substitute for an accessible name — pair it with
 * a real `aria-label` or `title` on the trigger.
 */
export function Tooltip({
  label,
  side = 'bottom',
  className,
  children,
}: {
  label: string
  side?: 'top' | 'bottom'
  className?: string
  children: ReactNode
}) {
  return (
    <span className={cn('group/tip relative inline-flex', className)}>
      {children}
      <span
        role="presentation"
        className={cn(
          'pointer-events-none absolute left-1/2 z-50 -translate-x-1/2 whitespace-nowrap rounded-md',
          'bg-navy px-2 py-1 text-xs text-white opacity-0 shadow-pop transition-opacity',
          'group-hover/tip:opacity-100 group-focus-within/tip:opacity-100',
          side === 'bottom' ? 'top-[calc(100%+6px)]' : 'bottom-[calc(100%+6px)]',
        )}
      >
        {label}
      </span>
    </span>
  )
}

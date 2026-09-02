import type { ReactNode } from 'react'

import { cn } from '@/lib/cn'

/** A filter pill. Replaces the private `Chip` in Notes and AnswerTimer. */
export function Chip({
  selected,
  onClick,
  count,
  className,
  children,
}: {
  selected: boolean
  onClick: () => void
  count?: number
  className?: string
  children: ReactNode
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={cn(
        'inline-flex h-8 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-3 text-sm transition-colors',
        selected
          ? 'border-accent-ring bg-accent-soft font-medium text-accent'
          : 'border-hairline bg-surface text-muted hover:border-edge hover:text-ink',
        className,
      )}
    >
      {children}
      {count !== undefined && (
        <span
          className={cn(
            'tabular-nums text-[11px]',
            selected ? 'text-accent/70' : 'text-faint',
          )}
        >
          {count}
        </span>
      )}
    </button>
  )
}

/**
 * Chips scroll sideways on a phone and wrap on a desktop. Wrapping on mobile
 * would push the content below the fold; scrolling on desktop would hide
 * filters behind an invisible overflow.
 */
export function ChipRow({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        'scroll-thin -mx-1 flex gap-2 overflow-x-auto px-1 pb-1 md:flex-wrap md:overflow-visible',
        className,
      )}
    >
      {children}
    </div>
  )
}

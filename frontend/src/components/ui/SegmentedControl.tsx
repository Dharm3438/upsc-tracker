import type { ReactNode } from 'react'

import { cn } from '@/lib/cn'

export type SegmentOption<T extends string> = {
  value: T
  label: string
  icon?: ReactNode
  count?: number
}

/**
 * The two-or-three-way switch used by Practice, Notes and the quick log. A
 * sliding pill rather than filled buttons: on a warm ground, two saturated
 * blocks side by side both read as "selected".
 */
export function SegmentedControl<T extends string>({
  value,
  options,
  onChange,
  size = 'md',
  full = false,
  label,
}: {
  value: T
  options: SegmentOption<T>[]
  onChange: (value: T) => void
  size?: 'sm' | 'md'
  full?: boolean
  label?: string
}) {
  return (
    <div
      role="tablist"
      aria-label={label}
      className={cn(
        'inline-flex items-center gap-1 rounded-lg border border-hairline bg-canvas p-1',
        full && 'flex w-full',
      )}
    >
      {options.map((option) => {
        const selected = option.value === value
        return (
          <button
            key={option.value}
            type="button"
            role="tab"
            aria-selected={selected}
            onClick={() => onChange(option.value)}
            className={cn(
              'inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-md font-medium transition-colors',
              size === 'sm' ? 'h-7 px-2.5 text-sm' : 'h-9 px-3.5 text-sm',
              full && 'flex-1',
              selected
                ? 'bg-surface text-ink shadow-xs ring-1 ring-hairline'
                : 'text-muted hover:text-ink',
            )}
          >
            {option.icon}
            {option.label}
            {option.count !== undefined && option.count > 0 && (
              <span
                className={cn(
                  'rounded-full px-1.5 text-[11px] tabular-nums',
                  selected ? 'bg-accent-soft text-accent' : 'bg-hairline text-muted',
                )}
              >
                {option.count}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}

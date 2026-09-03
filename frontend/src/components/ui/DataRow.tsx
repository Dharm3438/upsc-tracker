import type { ReactNode } from 'react'

import { cn } from '@/lib/cn'

/** A label/value line inside a card. Replaces three private `Row` copies. */
export function DataRow({
  label,
  value,
  hint,
  tone = 'default',
  className,
}: {
  label: ReactNode
  value: ReactNode
  hint?: ReactNode
  tone?: 'default' | 'danger' | 'success'
  className?: string
}) {
  return (
    <div
      className={cn(
        'flex min-h-[42px] flex-wrap items-center justify-between gap-x-4 gap-y-0.5 border-b border-hairline px-4 py-2 last:border-0 sm:px-5',
        className,
      )}
    >
      <div className="min-w-0">
        <span className="text-sm text-ink">{label}</span>
        {hint && <p className="text-xs text-muted">{hint}</p>}
      </div>
      <span
        className={cn(
          'flex shrink-0 items-center gap-2 whitespace-nowrap text-sm tabular-nums',
          tone === 'danger' && 'font-medium text-danger',
          tone === 'success' && 'font-medium text-success',
          tone === 'default' && 'text-muted',
        )}
      >
        {value}
      </span>
    </div>
  )
}

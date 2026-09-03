import type { ReactNode } from 'react'

import { cn } from '@/lib/cn'

/**
 * A labelled block on a page. This replaces five near-identical private
 * `Section` components that lived inside Today, Progress, NodeDetail,
 * AnswerDetail and TestDetail.
 */
export function Section({
  label,
  note,
  count,
  action,
  className,
  children,
}: {
  label: ReactNode
  note?: ReactNode
  count?: number
  action?: ReactNode
  className?: string
  children: ReactNode
}) {
  return (
    <section className={cn('min-w-0', className)}>
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 pb-2.5">
        <div className="min-w-0">
          <h2 className="text-xs font-semibold uppercase tracking-[0.08em] text-faint">
            {label}
            {count !== undefined && (
              <span className="ml-2 tabular-nums text-muted">{count}</span>
            )}
          </h2>
          {note && <p className="pt-1 text-xs text-muted">{note}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  )
}

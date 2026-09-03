import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'

import { cn } from '@/lib/cn'
import { ProgressBar } from './ProgressBar'

/**
 * One number, said once and said large. The whole point of the dashboard row is
 * that four of these answer "where am I" without reading a single sentence.
 */
export function StatTile({
  label,
  value,
  unit,
  sub,
  icon,
  tone = 'default',
  to,
  progress,
  loading = false,
}: {
  label: string
  value: ReactNode
  unit?: string
  sub?: ReactNode
  icon?: ReactNode
  tone?: 'default' | 'accent' | 'danger' | 'success'
  to?: string
  /** Renders a target meter under the number. */
  progress?: { value: number; max: number }
  loading?: boolean
}) {
  const body = (
    <>
      <div className="flex min-h-[30px] items-start justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-[0.08em] text-faint">{label}</p>
        {icon && (
          <span
            className={cn(
              'shrink-0 rounded-md p-1.5',
              tone === 'accent' && 'bg-accent-soft text-accent',
              tone === 'danger' && 'bg-danger-soft text-danger',
              tone === 'success' && 'bg-success-soft text-success',
              tone === 'default' && 'bg-hairline/60 text-muted',
            )}
          >
            {icon}
          </span>
        )}
      </div>

      {loading ? (
        <div className="mt-3 h-9 w-20 animate-pulse rounded bg-hairline" />
      ) : (
        <p className="mt-2 flex items-baseline gap-1.5">
          <span
            className={cn(
              'font-display text-4xl font-semibold leading-none tabular-nums',
              tone === 'danger' ? 'text-danger' : 'text-ink',
            )}
          >
            {value}
          </span>
          {unit && <span className="text-sm text-muted">{unit}</span>}
        </p>
      )}

      {progress && (
        <ProgressBar
          className="mt-3"
          size="xs"
          tone={tone === 'danger' ? 'danger' : 'depth'}
          value={progress.value}
          max={progress.max}
        />
      )}

      {sub && <p className="mt-2 text-xs text-muted">{sub}</p>}
    </>
  )

  const shell =
    'flex min-w-0 flex-col rounded-xl border border-hairline bg-surface p-4 shadow-card sm:p-5'

  if (to) {
    return (
      <Link to={to} className={cn(shell, 'transition-shadow hover:shadow-lift')}>
        {body}
      </Link>
    )
  }
  return <div className={shell}>{body}</div>
}

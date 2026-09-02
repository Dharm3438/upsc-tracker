import type { ReactNode } from 'react'

import { cn } from '@/lib/cn'

/**
 * The surface everything sits on. One elevation only: a hairline plus a warm
 * shadow. A second elevation would need a reason, and stacked cards on a paper
 * ground start to look like a pile of receipts.
 */
export function Card({
  children,
  className,
  as: Tag = 'section',
}: {
  children: ReactNode
  className?: string
  as?: 'section' | 'div' | 'article' | 'aside'
}) {
  return (
    <Tag
      className={cn(
        'flex min-w-0 flex-col overflow-hidden rounded-xl border border-hairline bg-surface shadow-card',
        className,
      )}
    >
      {children}
    </Tag>
  )
}

export function CardHeader({
  title,
  subtitle,
  icon,
  count,
  action,
  className,
}: {
  title: ReactNode
  subtitle?: ReactNode
  icon?: ReactNode
  /** Rendered next to the title, for "how many are in here". */
  count?: number
  action?: ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        'flex min-h-[52px] flex-wrap items-center justify-between gap-x-3 gap-y-1 border-b border-hairline px-4 py-3 sm:px-5',
        className,
      )}
    >
      <div className="flex min-w-0 items-center gap-2.5">
        {icon && <span className="shrink-0 text-accent">{icon}</span>}
        <div className="min-w-0">
          <h2 className="truncate font-display text-lg font-semibold leading-tight text-ink">
            {title}
            {count !== undefined && (
              <span className="ml-2 font-sans text-sm font-normal tabular-nums text-faint">
                {count}
              </span>
            )}
          </h2>
          {subtitle && <p className="truncate pt-0.5 text-xs text-muted">{subtitle}</p>}
        </div>
      </div>
      {action && <div className="flex shrink-0 items-center gap-2">{action}</div>}
    </div>
  )
}

export function CardBody({
  children,
  className,
  padded = true,
}: {
  children: ReactNode
  className?: string
  padded?: boolean
}) {
  return (
    <div className={cn('min-w-0 flex-1', padded && 'p-4 sm:p-5', className)}>{children}</div>
  )
}

export function CardFooter({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn('border-t border-hairline px-4 py-3 sm:px-5', className)}>{children}</div>
  )
}

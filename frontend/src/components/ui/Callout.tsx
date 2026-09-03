import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'

import { cn } from '@/lib/cn'

const TONE = {
  info: 'border-info/20 bg-info-soft text-info',
  accent: 'border-accent-ring bg-accent-soft text-accent',
  danger: 'border-danger/20 bg-danger-soft text-danger',
  success: 'border-success/20 bg-success-soft text-success',
} as const

/** A short, coloured sentence: the offline banner, the burn-down verdict, the
 *  "this answer is up for a rewrite" line. */
export function Callout({
  tone = 'info',
  icon: Icon,
  action,
  className,
  children,
}: {
  tone?: keyof typeof TONE
  icon?: LucideIcon
  action?: ReactNode
  className?: string
  children: ReactNode
}) {
  return (
    <div
      className={cn(
        'flex flex-wrap items-center justify-between gap-x-4 gap-y-2 rounded-lg border px-4 py-2.5 text-sm',
        TONE[tone],
        className,
      )}
    >
      <span className="flex min-w-0 items-start gap-2.5">
        {Icon && <Icon size={16} strokeWidth={1.8} className="mt-0.5 shrink-0" />}
        <span className="min-w-0">{children}</span>
      </span>
      {action && <span className="shrink-0">{action}</span>}
    </div>
  )
}

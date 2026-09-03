import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'

import { cn } from '@/lib/cn'

/**
 * Empty states invite the next action rather than apologising. The old version
 * of this component was a bare paragraph doing triple duty as empty, loading
 * and error; QueryBoundary now separates those three.
 */
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  size = 'md',
  className,
}: {
  icon?: LucideIcon
  title: string
  description?: ReactNode
  action?: ReactNode
  size?: 'sm' | 'md'
  className?: string
}) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center px-6 text-center',
        size === 'sm' ? 'py-8' : 'py-14',
        className,
      )}
    >
      {Icon && (
        <span className="mb-3 rounded-full bg-hairline/60 p-3 text-faint">
          <Icon size={size === 'sm' ? 18 : 22} strokeWidth={1.6} />
        </span>
      )}
      <p className="font-display text-base font-semibold text-ink">{title}</p>
      {description && (
        <p className="mt-1.5 max-w-sm text-sm leading-relaxed text-muted">{description}</p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}

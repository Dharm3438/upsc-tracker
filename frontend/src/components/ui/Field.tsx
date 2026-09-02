import type { ReactNode } from 'react'

import { cn } from '@/lib/cn'

/** Label above, control below, error under. Replaces the private `Field`
 *  components in QuickLogSheet and AnswerTimer. */
export function Field({
  label,
  hint,
  error,
  htmlFor,
  className,
  children,
}: {
  label: ReactNode
  hint?: ReactNode
  error?: ReactNode
  htmlFor?: string
  className?: string
  children: ReactNode
}) {
  return (
    <div className={cn('min-w-0', className)}>
      <label
        htmlFor={htmlFor}
        className="flex items-baseline justify-between gap-2 pb-1.5 text-xs font-medium text-muted"
      >
        <span>{label}</span>
        {hint && <span className="font-normal text-faint">{hint}</span>}
      </label>
      {children}
      {error && <p className="pt-1.5 text-xs text-danger">{error}</p>}
    </div>
  )
}

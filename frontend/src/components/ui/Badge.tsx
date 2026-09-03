import type { ReactNode } from 'react'

import { cn } from '@/lib/cn'

export type BadgeTone = 'neutral' | 'accent' | 'success' | 'danger' | 'dark' | 'outline'

const TONE: Record<BadgeTone, string> = {
  neutral: 'bg-hairline/70 text-muted',
  accent: 'bg-accent-soft text-accent',
  success: 'bg-success-soft text-success',
  danger: 'bg-danger-soft text-danger',
  dark: 'bg-navy text-white',
  outline: 'border border-edge text-muted',
}

export function Badge({
  tone = 'neutral',
  size = 'md',
  icon,
  className,
  children,
}: {
  tone?: BadgeTone
  size?: 'sm' | 'md'
  icon?: ReactNode
  className?: string
  children: ReactNode
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 whitespace-nowrap rounded-full font-medium tabular-nums',
        size === 'sm' ? 'px-1.5 py-0.5 text-[11px] leading-4' : 'px-2 py-0.5 text-xs',
        TONE[tone],
        className,
      )}
    >
      {icon}
      {children}
    </span>
  )
}

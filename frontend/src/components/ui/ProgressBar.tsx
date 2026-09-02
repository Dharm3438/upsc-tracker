import { cn } from '@/lib/cn'

const TONE = {
  accent: 'bg-accent',
  depth: 'bg-depth-4',
  success: 'bg-success',
  danger: 'bg-danger',
  navy: 'bg-navy',
} as const

export function ProgressBar({
  value,
  max = 100,
  tone = 'depth',
  size = 'md',
  className,
  label,
}: {
  value: number
  max?: number
  tone?: keyof typeof TONE
  size?: 'xs' | 'sm' | 'md'
  className?: string
  label?: string
}) {
  const pct = max > 0 ? Math.min(100, Math.max(0, (value / max) * 100)) : 0
  const height = size === 'xs' ? 'h-1' : size === 'sm' ? 'h-1.5' : 'h-2'

  return (
    <div
      role={label ? 'progressbar' : undefined}
      aria-label={label}
      aria-valuenow={label ? Math.round(pct) : undefined}
      aria-valuemin={label ? 0 : undefined}
      aria-valuemax={label ? 100 : undefined}
      className={cn('w-full overflow-hidden rounded-full bg-hairline', height, className)}
    >
      <div
        className={cn('h-full rounded-full transition-[width] duration-500', TONE[tone])}
        style={{ width: `${pct}%` }}
      />
    </div>
  )
}

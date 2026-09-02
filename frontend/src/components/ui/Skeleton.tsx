import { cn } from '@/lib/cn'

/**
 * Loading is not an empty state. Until now every screen said "Loading…" in the
 * same grey paragraph it used for "nothing here" and for "that failed", which
 * made a slow network indistinguishable from a broken one.
 */
export function Skeleton({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        'relative block overflow-hidden rounded bg-hairline/70',
        // The sweep is decoration; the block is legible without it, which
        // matters because the reduced-motion killswitch stops the animation.
        'after:absolute after:inset-0 after:-translate-x-full after:bg-gradient-to-r',
        'after:from-transparent after:via-white/50 after:to-transparent',
        'motion-safe:after:animate-[shimmer_1.6s_linear_infinite]',
        className,
      )}
    />
  )
}

export function SkeletonText({ lines = 3, className }: { lines?: number; className?: string }) {
  return (
    <div className={cn('space-y-2', className)}>
      {Array.from({ length: lines }).map((_, index) => (
        <Skeleton key={index} className={cn('h-3.5', index === lines - 1 ? 'w-2/3' : 'w-full')} />
      ))}
    </div>
  )
}

/** Rows shaped like the list they stand in for. */
export function SkeletonRows({ rows = 4, className }: { rows?: number; className?: string }) {
  return (
    <div className={cn('divide-y divide-hairline', className)}>
      {Array.from({ length: rows }).map((_, index) => (
        <div key={index} className="flex items-center gap-3 px-4 py-3 sm:px-5">
          <div className="min-w-0 flex-1 space-y-2">
            <Skeleton className="h-3.5 w-1/2" />
            <Skeleton className="h-3 w-1/3" />
          </div>
          <Skeleton className="h-3.5 w-12 shrink-0" />
        </div>
      ))}
    </div>
  )
}

export function SkeletonChart({ className }: { className?: string }) {
  return (
    <div className={cn('flex items-end gap-1.5 p-4 sm:p-5', className)}>
      {[38, 62, 45, 80, 55, 70, 48, 88, 60, 42].map((height, index) => (
        <div key={index} className="flex-1" style={{ height }}>
          <Skeleton className="h-full w-full" />
        </div>
      ))}
    </div>
  )
}

import { CalendarDays } from 'lucide-react'

import { useCountdown } from '@/hooks/useProgress'
import { formatDayIST } from '@/lib/date'
import { Skeleton } from '@/components/ui/Skeleton'

/**
 * The two numbers that matter: the calendar one everybody quotes, and the
 * honest one underneath it with her off-days taken out. Mains is not here —
 * it is a year out, and two countdowns at six in the morning is one too many.
 */
export function CountdownHero() {
  const countdown = useCountdown()

  return (
    <div className="relative overflow-hidden rounded-xl bg-navy px-5 py-5 text-white shadow-card sm:px-7 sm:py-6">
      {/* A warm wash across the corner so the navy band is not a flat slab. */}
      <div
        aria-hidden
        className="pointer-events-none absolute -right-16 -top-24 h-56 w-56 rounded-full bg-accent/25 blur-3xl"
      />
      <div className="relative flex flex-wrap items-end justify-between gap-x-8 gap-y-4">
        {countdown.data ? (
          <div>
            <p className="flex items-baseline gap-2.5">
              <span className="font-display text-5xl font-semibold leading-none tabular-nums sm:text-6xl">
                {Math.max(0, countdown.data.prelims.days)}
              </span>
              <span className="font-display text-xl text-white/70">days to Prelims</span>
            </p>
            <p className="mt-2.5 text-sm text-white/60">
              {countdown.data.prelims.study_days} of them are study days
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            <Skeleton className="h-12 w-64 bg-white/10" />
            <Skeleton className="h-3.5 w-40 bg-white/10" />
          </div>
        )}

        {countdown.data && (
          <p className="flex items-center gap-2 text-sm text-white/50">
            <CalendarDays size={15} strokeWidth={1.8} />
            {formatDayIST(countdown.data.prelims.date)}
          </p>
        )}
      </div>
    </div>
  )
}

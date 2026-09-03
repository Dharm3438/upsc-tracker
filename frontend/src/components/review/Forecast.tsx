import type { Upcoming } from '@/api/review'
import { cn } from '@/lib/cn'
import { weekdayIST } from '@/lib/date'

/**
 * The week ahead as seven columns. This is the only place the app admits that
 * revision compounds — seeing Thursday already stacked is what makes an easy
 * Tuesday worth using.
 */
export function Forecast({ data }: { data: Upcoming }) {
  // The backlog is today's workload, whatever day it was originally due, so it
  // belongs in today's column. Leaving it out made the bar say "nothing now"
  // while the list beside it showed six waiting.
  const days = data.days.map((day, index) =>
    index === 0 ? { ...day, count: day.count + data.overdue } : day,
  )
  const peak = Math.max(1, ...days.map((day) => day.count))

  return (
    <div className="flex items-end gap-1.5 px-4 pb-4 pt-2 sm:gap-2 sm:px-5">
      {days.map((day, index) => {
        const today = index === 0
        return (
          <div key={day.date} className="flex min-w-0 flex-1 flex-col items-center gap-1.5">
            <span
              className={cn(
                'text-xs tabular-nums',
                today ? 'font-semibold text-accent' : 'text-muted',
              )}
            >
              {day.count || ''}
            </span>
            {/* Heights are a share of a fixed track rather than computed pixels,
                so the same markup works in a phone card and a desktop one. */}
            <div className="flex h-16 w-full items-end sm:h-20 lg:h-24">
              <div
                className={cn(
                  'w-full rounded-t-sm transition-[height] duration-500',
                  day.count === 0
                    ? 'bg-hairline'
                    : today
                      ? 'bg-accent'
                      : 'bg-depth-3',
                )}
                // A day with nothing on it still draws a hairline, so the week
                // reads as a row of days rather than a row of gaps.
                style={{ height: day.count ? `${12 + (day.count / peak) * 88}%` : '3px' }}
              />
            </div>
            <span
              className={cn(
                'text-xs',
                today ? 'font-medium text-accent' : 'text-faint',
              )}
            >
              {initial(day.date, index)}
            </span>
          </div>
        )
      })}
    </div>
  )
}

const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S']

/** One letter per column. "Today" is worth naming; the rest are weekday
 *  initials, which is as much as fits under a narrow column. */
function initial(date: string, index: number): string {
  if (index === 0) return 'now'
  return WEEKDAYS[weekdayIST(date)] ?? ''
}

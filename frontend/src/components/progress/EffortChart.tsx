import { formatMinutes, type Effort } from '@/api/progress'
import { cn } from '@/lib/cn'
import { formatDayIST, weekdayIST } from '@/lib/date'

const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S']

/**
 * A month of study minutes, one column a day. A day she planned off is drawn as
 * a marked baseline rather than a zero — that distinction is the reason this
 * app tracks off-days instead of streaks, and a fortnight's planned break must
 * not read as a fortnight of failure.
 */
export function EffortChart({ data }: { data: Effort }) {
  const peak = Math.max(60, ...data.days.map((day) => day.minutes))
  const average = data.average_minutes

  return (
    <div className="p-4 sm:p-5">
      {/* Heights are a share of the track rather than computed pixels, so the
          same markup works at 96px on a phone and 160px on a desktop. */}
      <div className="relative flex h-24 items-end gap-[2px] lg:h-40 lg:gap-1">
        {average > 0 && (
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 border-t border-dashed border-edge"
            style={{ bottom: `${Math.min(100, (average / peak) * 100)}%` }}
          >
            <span className="absolute -top-2 right-0 -translate-y-full rounded bg-surface px-1 text-[10px] tabular-nums text-faint">
              avg {formatMinutes(average)}
            </span>
          </div>
        )}

        {data.days.map((day) => (
          <div
            key={day.date}
            className="flex h-full flex-1 items-end"
            title={`${formatDayIST(day.date)} — ${
              day.off && day.minutes === 0 ? 'off day' : formatMinutes(day.minutes)
            }`}
          >
            {day.minutes > 0 ? (
              <div
                className={cn(
                  'w-full rounded-t-sm transition-colors',
                  day.off ? 'bg-depth-2' : 'bg-depth-4 hover:bg-depth-5',
                )}
                style={{ height: `${Math.max(3, (day.minutes / peak) * 100)}%` }}
              />
            ) : (
              // A planned off-day is a marked baseline; an unplanned zero is a
              // hairline. Never a gap, and never a streak broken.
              <div
                className={cn(
                  'w-full',
                  day.off ? 'h-1 rounded-sm bg-edge' : 'h-[2px] bg-hairline',
                )}
              />
            )}
          </div>
        ))}
      </div>

      {/* Weekday ticks, once there is room for them. */}
      <div className="mt-1.5 hidden gap-1 lg:flex">
        {data.days.map((day, index) => (
          <span
            key={day.date}
            className="flex-1 text-center text-[10px] text-faint"
            aria-hidden
          >
            {index % 7 === data.days.length % 7 ? WEEKDAYS[weekdayIST(day.date)] : ''}
          </span>
        ))}
      </div>

      <div className="flex items-baseline justify-between pt-2 text-xs text-faint lg:hidden">
        <span>{formatDayIST(data.days[0]?.date ?? data.date)}</span>
        <span>Today</span>
      </div>

      <p className="pt-3 text-xs text-muted">
        {formatMinutes(data.average_minutes)} a day across {data.study_days} study days
        {data.days.some((day) => day.off) && ', off-days marked on the baseline'}.
      </p>
    </div>
  )
}

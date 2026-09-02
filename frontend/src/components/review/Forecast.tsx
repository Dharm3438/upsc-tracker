import type { Upcoming } from '@/api/review'
import { weekdayIST } from '@/lib/date'

/**
 * The week ahead as seven short columns. This is the only place the app admits
 * that revision compounds — seeing Thursday already stacked is what makes an
 * easy Tuesday worth using.
 */
export function Forecast({ data }: { data: Upcoming }) {
  // The backlog is today's workload, whatever day it was originally due, so
  // it belongs in today's column. Leaving it out made the bar say "nothing
  // now" while the list above it showed six waiting.
  const days = data.days.map((day, index) =>
    index === 0 ? { ...day, count: day.count + data.overdue } : day,
  )
  const peak = Math.max(1, ...days.map((day) => day.count))

  return (
    <div className="flex items-end gap-1.5 px-4 pb-3 pt-1">
      {days.map((day, index) => (
        <div key={day.date} className="flex flex-1 flex-col items-center gap-1">
          <span className="text-xs tabular-nums text-slate">{day.count || ''}</span>
          <div
            className={`w-full rounded-sm ${day.count ? 'bg-depth-3' : 'bg-depth-1'}`}
            // A day with nothing on it still draws a hairline, so the week
            // reads as a row of days rather than a row of gaps.
            style={{ height: `${day.count ? 6 + (day.count / peak) * 34 : 2}px` }}
          />
          <span className="text-xs text-slate">{initial(day.date, index)}</span>
        </div>
      ))}
    </div>
  )
}

const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S']

/** One letter per column. "Today" is worth naming; the rest are weekday
 *  initials, which is as much as fits under a 40px column. */
function initial(date: string, index: number): string {
  if (index === 0) return 'now'
  return WEEKDAYS[weekdayIST(date)] ?? ''
}

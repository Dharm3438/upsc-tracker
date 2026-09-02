import { formatMinutes, type Effort } from '@/api/progress'
import { formatDayIST } from '@/lib/date'

/**
 * A month of study minutes, one column a day. A day she planned off is drawn as
 * a marked baseline rather than a zero — that distinction is the reason this
 * app tracks off-days instead of streaks, and a fortnight's planned break must
 * not read as a fortnight of failure.
 */
export function EffortChart({ data }: { data: Effort }) {
  const peak = Math.max(60, ...data.days.map((day) => day.minutes))

  return (
    <div className="bg-surface px-4 py-4">
      <div className="flex h-24 items-end gap-[3px]">
        {data.days.map((day) => (
          <div
            key={day.date}
            className="flex-1"
            title={`${formatDayIST(day.date)} — ${
              day.off && day.minutes === 0 ? 'off day' : formatMinutes(day.minutes)
            }`}
          >
            {day.minutes > 0 ? (
              <div
                className={`w-full rounded-t-sm ${day.off ? 'bg-depth-2' : 'bg-depth-4'}`}
                style={{ height: `${Math.max(3, (day.minutes / peak) * 96)}px` }}
              />
            ) : (
              <div
                className={`w-full ${day.off ? 'h-1 rounded-sm bg-line' : 'h-[2px] bg-depth-1'}`}
              />
            )}
          </div>
        ))}
      </div>

      <div className="flex items-baseline justify-between pt-2 text-xs text-slate">
        <span>{formatDayIST(data.days[0]?.date ?? data.date)}</span>
        <span>Today</span>
      </div>

      <p className="pt-2 text-xs text-slate">
        {formatMinutes(data.average_minutes)} a day across {data.study_days} study days
        {data.days.some((day) => day.off) && ', off-days marked below the line'}.
      </p>
    </div>
  )
}

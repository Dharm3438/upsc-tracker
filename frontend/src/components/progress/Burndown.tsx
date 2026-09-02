import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

import type { Burndown as BurndownData } from '@/api/progress'
import { formatDayIST } from '@/lib/date'

/**
 * Two lines. The solid one is how many topics are actually left; the dashed one
 * is where that line has to be to reach zero by Prelims, falling in proportion
 * to the study days left rather than the calendar days.
 *
 * Above the dashed line means behind. That is the whole reading of the chart,
 * and it is written under it in words as well, because a line above another
 * line is not self-evidently bad news at six in the morning.
 */
export function Burndown({ data }: { data: BurndownData }) {
  const behind = data.actual_per_day !== null && data.actual_per_day < data.required_per_day
  const points = data.series.filter((point) => point.remaining !== null).length

  return (
    <div className="bg-surface pb-3 pt-4">
      <div className="h-48 pr-4">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data.series} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
            <CartesianGrid stroke="#DFE3E8" vertical={false} />
            <XAxis
              dataKey="date"
              tickFormatter={month}
              minTickGap={36}
              tick={{ fill: '#5B6470', fontSize: 12 }}
              tickLine={false}
              axisLine={{ stroke: '#DFE3E8' }}
            />
            <YAxis
              width={36}
              tick={{ fill: '#5B6470', fontSize: 12 }}
              tickLine={false}
              axisLine={false}
              allowDecimals={false}
            />
            <Tooltip
              contentStyle={{
                border: '1px solid #DFE3E8',
                borderRadius: 6,
                fontSize: 12,
              }}
              labelFormatter={(value: string) => formatDayIST(value)}
              formatter={(value: number, name: string) => [
                Math.round(value),
                name === 'remaining' ? 'Topics left' : 'On pace',
              ]}
            />
            {/* Where the actual line stops and the plan takes over. */}
            <ReferenceLine x={data.date} stroke="#DFE3E8" />
            <Line
              type="monotone"
              dataKey="required"
              stroke="#5B6470"
              strokeWidth={1.5}
              strokeDasharray="4 4"
              dot={false}
              isAnimationActive={false}
            />
            <Line
              type="monotone"
              dataKey="remaining"
              stroke="#2B44C7"
              strokeWidth={2}
              // A single point is a dot, not a line: on the first week of
              // logging there is one place the actual line can be, and it
              // should still be visible.
              dot={points < 2 ? { r: 3, fill: '#2B44C7' } : false}
              // The actual line is null past today rather than zero, and
              // joining across that gap would draw a finish she has not made.
              connectNulls={false}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <dl className="grid grid-cols-3 gap-2 border-t border-line px-4 pt-3">
        <Figure label="Topics left" value={String(data.remaining)} />
        <Figure
          label="Needed a day"
          value={data.required_per_day.toFixed(1)}
          note={`over ${data.study_days_remaining} study days`}
        />
        <Figure
          label="Your pace"
          value={data.actual_per_day === null ? '—' : data.actual_per_day.toFixed(1)}
          note={`last ${data.actual_window_days} days`}
        />
      </dl>

      <p className="px-4 pt-3 text-xs text-slate">{verdict(data, behind)}</p>
    </div>
  )
}

function Figure({
  label,
  value,
  note,
}: {
  label: string
  value: string
  note?: string
}) {
  return (
    <div>
      <dt className="text-xs text-slate">{label}</dt>
      <dd className="text-lg tabular-nums">{value}</dd>
      {note && <p className="text-xs text-slate">{note}</p>}
    </div>
  )
}

/** The sentence the chart is for. Said plainly, without softening the number
 *  and without adding an exclamation mark to it either. */
function verdict(data: BurndownData, behind: boolean): string {
  if (data.remaining === 0) return 'Every topic has been opened at least once.'
  if (data.started_leaves === 0) {
    return 'No reading logged yet, so there is no pace to compare against.'
  }
  if (!data.actual_per_day) {
    return `No new topic opened in the last ${data.actual_window_days} days. Revision still counts, but the burn-down only moves on new ground.`
  }
  if (!behind) {
    return data.projected_finish
      ? `At this pace the syllabus is covered by ${formatDayIST(data.projected_finish)}, ahead of Prelims.`
      : 'You are keeping ahead of the pace this needs.'
  }
  const shortfall = data.required_per_day - data.actual_per_day
  return data.projected_finish
    ? `${shortfall.toFixed(1)} topics a day behind — this pace finishes on ${formatDayIST(
        data.projected_finish,
      )}, after Prelims.`
    : `${shortfall.toFixed(1)} topics a day behind the pace this needs.`
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/** Months, not dates: the axis spans two years and the shape is what matters. */
function month(day: string): string {
  const [, index] = day.split('-').map(Number)
  return MONTHS[index - 1] ?? ''
}

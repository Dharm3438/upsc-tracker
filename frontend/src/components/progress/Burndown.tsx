import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

import type { Burndown as BurndownData } from '@/api/progress'
import { Callout } from '@/components/ui'
import { formatDayIST } from '@/lib/date'
import { COLOR } from '@/lib/tokens'

// SVG attributes cannot read Tailwind classes, so the chart palette is the one
// place the tokens have to exist as literal strings. Mirrors tailwind.config.ts.
const TOOLTIP = {
  background: COLOR.surface,
  border: `1px solid ${COLOR.hairline}`,
  borderRadius: 10,
  boxShadow: '0 8px 24px -8px rgba(60,45,25,0.2)',
  fontSize: 12,
  color: COLOR.ink,
} as const

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
  // Two years of series wants month ticks; a short window wants days, or every
  // tick reads "Sep".
  const span = data.series.length

  return (
    <div>
      <div className="h-56 px-2 pt-4 sm:h-64 lg:h-72">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data.series} margin={{ top: 4, right: 12, bottom: 0, left: 0 }}>
            <defs>
              <linearGradient id="burndown-fill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={COLOR.accent} stopOpacity={0.18} />
                <stop offset="100%" stopColor={COLOR.accent} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke={COLOR.hairline} strokeDasharray="2 4" vertical={false} />
            <XAxis
              dataKey="date"
              tickFormatter={(day: string) => tick(day, span)}
              minTickGap={36}
              tickMargin={8}
              tick={{ fill: COLOR.muted, fontSize: 12 }}
              tickLine={false}
              axisLine={{ stroke: COLOR.hairline }}
            />
            <YAxis
              width={40}
              tick={{ fill: COLOR.muted, fontSize: 12 }}
              tickLine={false}
              axisLine={false}
              allowDecimals={false}
            />
            <Tooltip
              contentStyle={TOOLTIP}
              itemStyle={{ color: COLOR.ink }}
              labelStyle={{ color: COLOR.muted, marginBottom: 2 }}
              cursor={{ stroke: COLOR.edge, strokeDasharray: '3 3' }}
              labelFormatter={(value: string) => formatDayIST(value)}
              formatter={(value: number, name: string) => [
                Math.round(value),
                name === 'remaining' ? 'Topics left' : 'On pace',
              ]}
            />
            {/* Where the actual line stops and the plan takes over. */}
            <ReferenceLine
              x={data.date}
              stroke={COLOR.edge}
              label={{ value: 'today', position: 'top', fill: COLOR.faint, fontSize: 11 }}
            />
            <Line
              type="monotone"
              dataKey="required"
              stroke={COLOR.faint}
              strokeWidth={1.5}
              strokeDasharray="4 4"
              dot={false}
              isAnimationActive={false}
            />
            {/* A wash under the actual line. At this width a 2px stroke alone
                disappears into the card. */}
            <Area
              type="monotone"
              dataKey="remaining"
              stroke={COLOR.accent}
              strokeWidth={2}
              fill="url(#burndown-fill)"
              // A single point is a dot, not a line: on the first week of
              // logging there is one place the actual line can be, and it
              // should still be visible.
              dot={points < 2 ? { r: 3.5, fill: COLOR.accent } : false}
              // The actual line is null past today rather than zero, and
              // joining across that gap would draw a finish she has not made.
              connectNulls={false}
              isAnimationActive={false}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* The sentence is the point of the chart; a line above another line is
          not self-evidently bad news at six in the morning. */}
      <div className="border-t border-hairline p-4 sm:p-5">
        <Callout tone={behind ? 'accent' : 'success'}>{verdict(data, behind)}</Callout>
      </div>
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

/** Months once the axis spans seasons — the shape is what matters there. Days
 *  while it is still short, because twelve ticks all reading "Sep" say nothing. */
function tick(day: string, span: number): string {
  const [, index, date] = day.split('-').map(Number)
  const month = MONTHS[index - 1] ?? ''
  return span > 120 ? month : `${date} ${month}`
}

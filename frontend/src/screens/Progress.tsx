import { useState } from 'react'
import { CalendarDays, ClipboardList, Grid3x3, Layers, Timer, TrendingDown } from 'lucide-react'

import { formatMinutes } from '@/api/progress'
import type { Paper } from '@/api/syllabus'
import { PaperChips } from '@/components/PaperChips'
import { Burndown } from '@/components/progress/Burndown'
import { Coverage } from '@/components/progress/Coverage'
import { EffortChart } from '@/components/progress/EffortChart'
import { Heatmap, HeatmapLegend } from '@/components/progress/Heatmap'
import { WeeklyReviewCard } from '@/components/progress/WeeklyReviewCard'
import {
  Card,
  CardHeader,
  EmptyState,
  PageHeader,
  QueryBoundary,
  SkeletonChart,
  SkeletonRows,
  StatTile,
} from '@/components/ui'
import {
  useBurndown,
  useCountdown,
  useCoverage,
  useEffort,
  useHeatmap,
} from '@/hooks/useProgress'
import { usePapers } from '@/hooks/useSyllabus'
import { formatDayIST } from '@/lib/date'

/**
 * A weekly screen, not a daily one. It answers four questions in order — how
 * much is left, how much is covered, how strong each topic is, and what the
 * month of effort actually looked like — and then asks three of its own.
 *
 * Nothing here is a streak and nothing is red for its own sake. The honest
 * figures are hard enough without the interface having an opinion about them.
 */
export function Progress() {
  const countdown = useCountdown()
  const burndown = useBurndown()
  const coverage = useCoverage()
  const effort = useEffort(30)
  const papers = usePapers()
  const [paper, setPaper] = useState<Paper>('GS1')
  const heatmap = useHeatmap(paper)

  return (
    <>
      <PageHeader
        title="Progress"
        subtitle="Where the pace actually is, once the off-days are taken out of it."
      />

      <div className="mb-4 grid grid-cols-2 gap-3 lg:mb-5 lg:grid-cols-4 lg:gap-5">
        <StatTile
          label="To Prelims"
          icon={<CalendarDays size={16} strokeWidth={1.9} />}
          loading={!countdown.data}
          value={countdown.data?.prelims.days ?? 0}
          unit="days"
          sub={
            countdown.data &&
            `${countdown.data.prelims.study_days} study days · ${formatDayIST(
              countdown.data.prelims.date,
            )}`
          }
        />
        <StatTile
          label="Topics left"
          icon={<TrendingDown size={16} strokeWidth={1.9} />}
          loading={!burndown.data}
          value={burndown.data?.remaining ?? 0}
          sub={burndown.data && `of ${burndown.data.total_leaves} in the syllabus`}
          progress={
            burndown.data
              ? { value: burndown.data.started_leaves, max: burndown.data.total_leaves }
              : undefined
          }
        />
        <StatTile
          label="Needed a day"
          icon={<Layers size={16} strokeWidth={1.9} />}
          loading={!burndown.data}
          value={burndown.data?.required_per_day.toFixed(1) ?? '—'}
          sub={
            burndown.data &&
            `your pace: ${
              burndown.data.actual_per_day === null
                ? '—'
                : burndown.data.actual_per_day.toFixed(1)
            } over ${burndown.data.actual_window_days} days`
          }
          tone={
            burndown.data &&
            burndown.data.actual_per_day !== null &&
            burndown.data.actual_per_day < burndown.data.required_per_day
              ? 'danger'
              : 'default'
          }
        />
        <StatTile
          label="Effort, 30 days"
          icon={<Timer size={16} strokeWidth={1.9} />}
          loading={!effort.data}
          value={effort.data ? formatMinutes(effort.data.total_minutes) : '—'}
          sub={effort.data && `${formatMinutes(effort.data.average_minutes)} a day`}
        />
      </div>

      <div className="grid grid-cols-12 items-start gap-4 lg:gap-5">
        <Card className="col-span-12">
          <CardHeader
            title="Burn-down"
            subtitle="Topics left against the pace that clears them before Prelims."
            icon={<TrendingDown size={17} strokeWidth={1.8} />}
          />
          <QueryBoundary
            query={burndown}
            error="Could not load the burn-down."
            skeleton={<SkeletonChart className="h-56" />}
          >
            {(data) => <Burndown data={data} />}
          </QueryBoundary>
        </Card>

        <Card className="col-span-12 self-start lg:col-span-6">
          <CardHeader
            title="Coverage"
            subtitle="Read once, revised twice, practised."
            icon={<Layers size={17} strokeWidth={1.8} />}
          />
          <QueryBoundary
            query={coverage}
            error="Could not load coverage."
            skeleton={<SkeletonRows rows={4} />}
            isEmpty={(data) => data.papers.length === 0}
            empty={
              <EmptyState
                title="Nothing logged yet."
                description="The bars fill as topics are read."
              />
            }
          >
            {(data) => <Coverage data={data} />}
          </QueryBoundary>
        </Card>

        <Card className="col-span-12 self-start lg:col-span-6">
          <CardHeader
            title="Effort"
            subtitle={
              effort.data
                ? `${formatMinutes(effort.data.total_minutes)} over the last 30 days.`
                : 'The last 30 days.'
            }
            icon={<Timer size={17} strokeWidth={1.8} />}
          />
          <QueryBoundary
            query={effort}
            error="Could not load effort."
            skeleton={<SkeletonChart className="h-24" />}
          >
            {(data) => <EffortChart data={data} />}
          </QueryBoundary>
        </Card>

        <Card className="col-span-12">
          <CardHeader
            title="Heatmap"
            subtitle="Every topic in the paper, coloured by how well it comes back."
            icon={<Grid3x3 size={17} strokeWidth={1.8} />}
            action={<HeatmapLegend />}
          />
          {papers.data && (
            <div className="border-b border-hairline px-4 py-3 sm:px-5">
              <PaperChips papers={papers.data} selected={paper} onSelect={setPaper} />
            </div>
          )}
          <QueryBoundary
            query={heatmap}
            error="Could not load the heatmap."
            skeleton={<SkeletonRows rows={4} />}
            isEmpty={(data) => data.sections.length === 0}
            empty={<EmptyState title="Nothing in this paper yet." />}
          >
            {(data) => <Heatmap sections={data.sections} />}
          </QueryBoundary>
        </Card>

        <Card className="col-span-12">
          <CardHeader
            title="Weekly review"
            subtitle="Three questions, written once a week, kept with the week's numbers."
            icon={<ClipboardList size={17} strokeWidth={1.8} />}
          />
          <WeeklyReviewCard />
        </Card>
      </div>
    </>
  )
}

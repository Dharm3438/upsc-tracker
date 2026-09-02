import { useState } from 'react'

import { formatMinutes } from '@/api/progress'
import type { Paper } from '@/api/syllabus'
import { EmptyState } from '@/components/EmptyState'
import { PaperChips } from '@/components/PaperChips'
import { Burndown } from '@/components/progress/Burndown'
import { Coverage } from '@/components/progress/Coverage'
import { EffortChart } from '@/components/progress/EffortChart'
import { Heatmap, HeatmapLegend } from '@/components/progress/Heatmap'
import { WeeklyReviewCard } from '@/components/progress/WeeklyReviewCard'
import { Header } from '@/components/shell/Header'
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
 * Nothing here is a streak and nothing is red. The honest figures are hard
 * enough without the interface having an opinion about them.
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
      <Header title="Progress" />

      {countdown.data && (
        <div className="px-4 pb-2">
          <p className="text-xl">
            {countdown.data.prelims.days} days to Prelims
          </p>
          <p className="text-sm text-slate">
            {countdown.data.prelims.study_days} of them are study days ·{' '}
            {formatDayIST(countdown.data.prelims.date)}
          </p>
        </div>
      )}

      <Section
        label="Burn-down"
        note="Topics left against the pace that clears them before Prelims."
      >
        {burndown.data ? (
          <Burndown data={burndown.data} />
        ) : (
          <EmptyState>{burndown.isError ? 'Could not load the burn-down.' : 'Loading…'}</EmptyState>
        )}
      </Section>

      <Section label="Coverage" note="Read once, revised twice, practised.">
        {coverage.data && coverage.data.papers.length > 0 ? (
          <Coverage data={coverage.data} />
        ) : (
          <EmptyState>
            {coverage.isError
              ? 'Could not load coverage.'
              : coverage.data
                ? 'Nothing logged yet. The bars fill as topics are read.'
                : 'Loading…'}
          </EmptyState>
        )}
      </Section>

      <section className="mt-6">
        <div className="flex items-baseline justify-between px-4 pb-2">
          <h2 className="text-xs uppercase tracking-wide text-slate">Heatmap</h2>
        </div>
        {papers.data && (
          <PaperChips papers={papers.data} selected={paper} onSelect={setPaper} />
        )}
        <HeatmapLegend />
        <div className="border-y border-line bg-surface">
          {heatmap.data ? (
            heatmap.data.sections.length > 0 ? (
              <Heatmap sections={heatmap.data.sections} />
            ) : (
              <EmptyState>Nothing in this paper yet.</EmptyState>
            )
          ) : (
            <EmptyState>{heatmap.isError ? 'Could not load the heatmap.' : 'Loading…'}</EmptyState>
          )}
        </div>
      </section>

      <Section
        label="Effort"
        note={
          effort.data
            ? `${formatMinutes(effort.data.total_minutes)} over the last 30 days.`
            : undefined
        }
      >
        {effort.data ? (
          <EffortChart data={effort.data} />
        ) : (
          <EmptyState>{effort.isError ? 'Could not load effort.' : 'Loading…'}</EmptyState>
        )}
      </Section>

      <section className="mt-6 pb-8">
        <div className="px-4 pb-2">
          <h2 className="text-xs uppercase tracking-wide text-slate">Weekly review</h2>
        </div>
        <WeeklyReviewCard />
      </section>
    </>
  )
}

function Section({
  label,
  note,
  children,
}: {
  label: string
  note?: string
  children: React.ReactNode
}) {
  return (
    <section className="mt-6">
      <div className="px-4 pb-2">
        <h2 className="text-xs uppercase tracking-wide text-slate">{label}</h2>
        {note && <p className="pt-0.5 text-xs text-slate">{note}</p>}
      </div>
      <div className="border-y border-line bg-surface">{children}</div>
    </section>
  )
}

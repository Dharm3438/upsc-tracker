import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'

import type { DueNode } from '@/api/review'
import { getHealth } from '@/api/client'
import { EmptyState } from '@/components/EmptyState'
import { DueList } from '@/components/review/DueList'
import { Forecast } from '@/components/review/Forecast'
import { GradeSheet } from '@/components/review/GradeSheet'
import { Header } from '@/components/shell/Header'
import { useDue, useUpcoming } from '@/hooks/useReview'

/**
 * The default landing screen. Phase 3 fills in the half that matters most —
 * what is due and grading it. The countdown, the reading shortcuts and the
 * answer and current-affairs rows arrive with the phases that own that data.
 */
export function Today() {
  const [grading, setGrading] = useState<DueNode | null>(null)
  const due = useDue()
  const upcoming = useUpcoming()
  const health = useQuery({ queryKey: ['health'], queryFn: getHealth, refetchInterval: 60_000 })

  const offline = health.data && !health.data.mongo

  return (
    <>
      <Header />

      {offline && (
        <p className="mx-4 rounded border border-line bg-surface px-3 py-2 text-sm text-overdue">
          The server cannot reach the database. Nothing will save until it can.
        </p>
      )}

      <Section
        label="Due for revision"
        // The heading counts everything due, not just the rows on screen.
        count={due.data?.total}
      >
        <DueBody query={due} onGrade={setGrading} />
      </Section>

      {upcoming.data && (
        <Section label="The week ahead">
          <Forecast data={upcoming.data} />
          {upcoming.data.overdue > 0 && (
            <p className="border-t border-line px-4 py-2 text-xs text-overdue">
              {upcoming.data.overdue} of today's carried over from an earlier day.
            </p>
          )}
        </Section>
      )}

      {grading && <GradeSheet node={grading} onClose={() => setGrading(null)} />}
    </>
  )
}

function DueBody({
  query,
  onGrade,
}: {
  query: ReturnType<typeof useDue>
  onGrade: (node: DueNode) => void
}) {
  if (query.isError) return <EmptyState>Could not load what is due.</EmptyState>
  if (!query.data) return <EmptyState>Loading…</EmptyState>
  if (query.data.items.length === 0) {
    return <EmptyState>Nothing to revise today. Good day to start something new.</EmptyState>
  }
  return <DueList items={query.data.items} onGrade={onGrade} />
}

function Section({
  label,
  count,
  children,
}: {
  label: string
  count?: number
  children: React.ReactNode
}) {
  return (
    <section className="mt-6">
      <div className="flex items-baseline justify-between px-4 pb-2">
        <h2 className="text-xs uppercase tracking-wide text-slate">{label}</h2>
        {count !== undefined && (
          <span className="text-sm tabular-nums text-slate">{count}</span>
        )}
      </div>
      <div className="border-y border-line bg-surface">{children}</div>
    </section>
  )
}

import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'

import type { DueNode } from '@/api/review'
import { getHealth } from '@/api/client'
import { EmptyState } from '@/components/EmptyState'
import { DueList } from '@/components/review/DueList'
import { Forecast } from '@/components/review/Forecast'
import { GradeSheet } from '@/components/review/GradeSheet'
import { Header } from '@/components/shell/Header'
import { useAnswersOn, useRedoQueue } from '@/hooks/useAnswers'
import { useCaInbox } from '@/hooks/useCa'
import { useDue, useUpcoming } from '@/hooks/useReview'
import { todayIST } from '@/lib/date'

/**
 * The default landing screen. What is due and grading it is the half that
 * matters most; answer writing and the current-affairs inbox sit under it. The
 * countdown and the reading shortcuts arrive with the phases that own them.
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

      <AnswerWriting />

      <CurrentAffairs />

      {grading && <GradeSheet node={grading} onClose={() => setGrading(null)} />}
    </>
  )
}

/** Answer writing on Today: what she has written since midnight, what the redo
 *  queue is asking for, and one tap to start. The daily target the plan sketches
 *  needs settings, which land in phase 8. */
function AnswerWriting() {
  const today = useAnswersOn(todayIST())
  const redo = useRedoQueue()
  const written = today.data?.items.length ?? 0
  const due = redo.data?.length ?? 0

  return (
    <Section label="Answer writing" count={today.data ? written : undefined}>
      {due > 0 && (
        <p className="border-b border-line px-4 py-2.5 text-sm">
          {due} {due === 1 ? 'answer is' : 'answers are'} up for a rewrite.
        </p>
      )}
      <div className="p-4">
        <Link
          to="/practice/answers/new"
          className="flex h-tap w-full items-center justify-center rounded border border-signal text-sm font-medium text-signal"
        >
          Start an answer
        </Link>
      </div>
    </Section>
  )
}

/** Current affairs on Today is an inbox count, not a feed: the question the
 *  screen answers is "is there anything of yesterday's left to place?" */
function CurrentAffairs() {
  const inbox = useCaInbox()
  const waiting = inbox.data?.total ?? 0

  return (
    <Section label="Current affairs" count={inbox.data ? waiting : undefined}>
      <Link
        to="/notes?tab=ca"
        className="flex min-h-tap items-center justify-between gap-3 px-4 py-2.5"
      >
        <span className="text-sm">
          {waiting === 0
            ? 'Inbox clear.'
            : `${waiting} ${waiting === 1 ? 'item' : 'items'} to tag`}
        </span>
        <span className="shrink-0 text-sm text-signal">
          {waiting === 0 ? 'Add one' : 'Tag them'}
        </span>
      </Link>
    </Section>
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

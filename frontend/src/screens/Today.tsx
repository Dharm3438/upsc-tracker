import {
  BookOpen,
  ChevronRight,
  Layers,
  ListChecks,
  Newspaper,
  PenLine,
  Plus,
  RotateCcw,
  Timer,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'

import { formatMinutes } from '@/api/progress'
import type { PaperCoverage } from '@/api/progress'
import { Forecast } from '@/components/review/Forecast'
import { QuickLogSheet } from '@/components/log/QuickLogSheet'
import { CountdownHero } from '@/components/today/CountdownHero'
import { DueCard } from '@/components/today/DueCard'
import { RecentActivity } from '@/components/today/RecentActivity'
import {
  Callout,
  Card,
  CardBody,
  CardHeader,
  LinkButton,
  PageHeader,
  Button,
  StatTile,
} from '@/components/ui'
import { useAnswersOn, useRedoQueue } from '@/hooks/useAnswers'
import { useCaInbox } from '@/hooks/useCa'
import { useCoverage, useEffort } from '@/hooks/useProgress'
import { useSettings } from '@/hooks/useSettings'
import { useDue, useUpcoming } from '@/hooks/useReview'
import { formatDayIST, todayIST, weekStartIST } from '@/lib/date'

/**
 * The default landing screen, and the only one with a genuine dashboard shape:
 * four figures that answer "where am I", then the widgets that answer "what
 * now". What is due and grading it is the half that matters most, so it takes
 * the widest column.
 */
export function Today() {
  const [logging, setLogging] = useState(false)

  return (
    <>
      <PageHeader
        eyebrow={formatDayIST(new Date())}
        title="Today"
        actions={
          <>
            <Button
              variant="secondary"
              icon={<Plus size={15} strokeWidth={2.1} />}
              onClick={() => setLogging(true)}
            >
              Log something
            </Button>
            <LinkButton
              to="/practice/answers/new"
              variant="primary"
              icon={<Timer size={15} strokeWidth={2} />}
            >
              Start an answer
            </LinkButton>
          </>
        }
      />

      <CountdownHero />

      <KpiRow />

      <div className="mt-4 grid grid-cols-12 items-start gap-4 lg:mt-5 lg:gap-5">
        <DueCard />
        {/* Stacked as one grid cell rather than two, so the tall due list beside
            them does not stretch either of them to match it. */}
        <div className="col-span-12 space-y-4 lg:col-span-5 lg:space-y-5">
          <WeekAhead />
          <AnswerWriting />
        </div>
        <CurrentAffairs />
        <QuickActions />
        <RecentActivity />
      </div>

      {logging && <QuickLogSheet onClose={() => setLogging(false)} />}
    </>
  )
}

/** Four numbers, each measured against its target where one exists. The
 *  targets live in Settings and were, until now, stored and never read. */
function KpiRow() {
  const due = useDue()
  const upcoming = useUpcoming()
  const effort = useEffort(14)
  const coverage = useCoverage()
  const settings = useSettings()
  const answers = useAnswersOn(todayIST())

  const targets = settings.data?.daily_targets

  const days = effort.data?.days ?? []
  const weekStart = weekStartIST()
  const weekMinutes = days
    .filter((day) => day.date >= weekStart)
    .reduce((total, day) => total + day.minutes, 0)
  const todayMinutes = days.find((day) => day.date === todayIST())?.minutes ?? 0

  // `totals` is null when only one paper has been seeded, so sum the papers
  // rather than showing a dash for a perfectly answerable question.
  const totals: PaperCoverage | null =
    coverage.data?.totals ??
    (coverage.data
      ? coverage.data.papers.reduce<PaperCoverage | null>(
          (sum, paper) =>
            sum === null
              ? { ...paper, label: 'All papers' }
              : {
                  ...sum,
                  leaves: sum.leaves + paper.leaves,
                  read: sum.read + paper.read,
                  revised: sum.revised + paper.revised,
                  tested: sum.tested + paper.tested,
                },
          null,
        )
      : null)

  const written = answers.data?.items.length ?? 0
  const overdue = upcoming.data?.overdue ?? 0

  return (
    <div className="mt-4 grid grid-cols-2 gap-3 lg:mt-5 lg:grid-cols-4 lg:gap-5">
      <StatTile
        label="Due today"
        icon={<RotateCcw size={16} strokeWidth={1.9} />}
        tone={overdue > 0 ? 'danger' : 'accent'}
        loading={!due.data}
        value={due.data?.total ?? 0}
        to="/progress"
        progress={
          targets ? { value: due.data?.total ?? 0, max: targets.revision_nodes } : undefined
        }
        sub={
          overdue > 0
            ? `${overdue} carried over from an earlier day`
            : targets && `a full day is ${targets.revision_nodes}`
        }
      />
      <StatTile
        label="Studied today"
        icon={<Timer size={16} strokeWidth={1.9} />}
        loading={!effort.data}
        value={formatMinutes(todayMinutes)}
        progress={targets ? { value: todayMinutes, max: targets.study_minutes } : undefined}
        sub={`${formatMinutes(weekMinutes)} so far this week`}
      />
      <StatTile
        label="Answers today"
        icon={<PenLine size={16} strokeWidth={1.9} />}
        loading={!answers.data}
        value={written}
        to="/practice"
        progress={targets ? { value: written, max: targets.answers } : undefined}
        sub={targets && `a full day is ${targets.answers}`}
      />
      <StatTile
        label="Coverage"
        icon={<Layers size={16} strokeWidth={1.9} />}
        loading={!coverage.data}
        value={totals && totals.leaves > 0 ? Math.round((totals.read / totals.leaves) * 100) : 0}
        unit="%"
        to="/progress"
        progress={totals ? { value: totals.read, max: totals.leaves } : undefined}
        sub={totals && `${totals.read} of ${totals.leaves} topics read`}
      />
    </div>
  )
}

function WeekAhead() {
  const upcoming = useUpcoming()
  if (!upcoming.data) return null

  return (
    <Card>
      <CardHeader
        title="The week ahead"
        subtitle="Revision compounds. An easy Tuesday is worth using."
      />
      <CardBody padded={false} className="pt-2">
        <Forecast data={upcoming.data} />
        {upcoming.data.overdue > 0 && (
          <p className="border-t border-hairline px-5 py-2.5 text-xs text-danger">
            {upcoming.data.overdue} of today's carried over from an earlier day.
          </p>
        )}
      </CardBody>
    </Card>
  )
}

/** What she has written since midnight, what the redo queue is asking for, and
 *  one click to start. */
function AnswerWriting() {
  const today = useAnswersOn(todayIST())
  const redo = useRedoQueue()
  const written = today.data?.items.length ?? 0
  const due = redo.data?.length ?? 0

  return (
    <Card>
      <CardHeader
        title="Answer writing"
        count={today.data ? written : undefined}
        icon={<PenLine size={17} strokeWidth={1.8} />}
      />
      <CardBody className="flex flex-1 flex-col justify-between gap-4">
        {due > 0 ? (
          <Callout tone="accent" icon={RotateCcw}>
            {due} {due === 1 ? 'answer is' : 'answers are'} up for a rewrite.
          </Callout>
        ) : (
          <p className="text-sm text-muted">
            {written === 0
              ? 'Nothing written yet today.'
              : `${written} written today. Nothing waiting for a rewrite.`}
          </p>
        )}
        <LinkButton to="/practice/answers/new" variant="primary" full>
          Start an answer
        </LinkButton>
      </CardBody>
    </Card>
  )
}

/** Current affairs on Today is an inbox count, not a feed: the question the
 *  card answers is "is there anything of yesterday's left to place?" */
function CurrentAffairs() {
  const inbox = useCaInbox()
  const waiting = inbox.data?.total ?? 0

  return (
    <Card className="col-span-12 md:col-span-6 lg:col-span-4">
      <CardHeader
        title="Current affairs"
        count={inbox.data ? waiting : undefined}
        icon={<Newspaper size={17} strokeWidth={1.8} />}
      />
      <CardBody className="flex flex-1 flex-col justify-between gap-4">
        <p className="text-sm text-muted">
          {waiting === 0
            ? 'Inbox clear. Two lines a day is enough.'
            : `${waiting} ${waiting === 1 ? 'item' : 'items'} still to tag to a topic.`}
        </p>
        <LinkButton
          to="/notes?tab=ca"
          variant={waiting > 0 ? 'primary' : 'secondary'}
          full
        >
          {waiting === 0 ? 'Add one' : 'Tag them'}
        </LinkButton>
      </CardBody>
    </Card>
  )
}

const ACTIONS: { to: string; label: string; hint: string; icon: LucideIcon }[] = [
  { to: '/syllabus', label: 'Open the syllabus', hint: 'Find a topic to read', icon: BookOpen },
  { to: '/practice', label: 'Add a test', hint: 'Log an attempt and its mistakes', icon: ListChecks },
  { to: '/notes', label: 'Mistake notebook', hint: 'The patterns beat the score', icon: Newspaper },
]

function QuickActions() {
  return (
    <Card className="col-span-12 md:col-span-6 lg:col-span-4">
      <CardHeader title="Elsewhere" />
      <ul className="divide-y divide-hairline">
        {ACTIONS.map((action) => (
          <li key={action.to}>
            <Link
              to={action.to}
              className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-canvas sm:px-5"
            >
              <span className="shrink-0 rounded-md bg-accent-soft p-1.5 text-accent">
                <action.icon size={15} strokeWidth={1.8} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm text-ink">{action.label}</span>
                <span className="block truncate text-xs text-muted">{action.hint}</span>
              </span>
              <ChevronRight size={16} className="shrink-0 text-hairline" aria-hidden />
            </Link>
          </li>
        ))}
      </ul>
    </Card>
  )
}

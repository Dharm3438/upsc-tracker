import { Layers, PenLine, RotateCcw, Timer } from 'lucide-react'

import { formatMinutes } from '@/api/progress'
import type { SubjectCoverage } from '@/api/progress'
import { Forecast } from '@/components/review/Forecast'
import { CountdownHero } from '@/components/today/CountdownHero'
import { DueCard } from '@/components/today/DueCard'
import {
  Card,
  CardBody,
  CardHeader,
  LinkButton,
  PageHeader,
  StatTile,
} from '@/components/ui'
import { useAnswersOn } from '@/hooks/useAnswers'
import { useCoverage, useEffort } from '@/hooks/useProgress'
import { useSettings } from '@/hooks/useSettings'
import { useDue, useUpcoming } from '@/hooks/useReview'
import { formatDayIST, todayIST, weekStartIST } from '@/lib/date'

/**
 * The default landing screen, and the only one with a genuine dashboard shape:
 * four figures that answer "where am I", then what is due and what the week
 * ahead looks like. Anything that only linked somewhere else has been dropped —
 * the nav already goes there.
 */
export function Today() {
  return (
    <>
      <PageHeader
        eyebrow={formatDayIST(new Date())}
        title="Today"
        actions={
          <LinkButton
            to="/syllabus"
            variant="primary"
            icon={<Timer size={15} strokeWidth={2} />}
          >
            Log something
          </LinkButton>
        }
      />

      <CountdownHero />

      <KpiRow />

      <div className="mt-4 grid grid-cols-12 items-start gap-4 lg:mt-5 lg:gap-5">
        <DueCard />
        <div className="col-span-12 space-y-4 lg:col-span-5 lg:space-y-5">
          <WeekAhead />
        </div>
      </div>
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

  // `totals` is null when only one subject has been seeded, so sum the subjects
  // rather than showing a dash for a perfectly answerable question.
  const totals: SubjectCoverage | null =
    coverage.data?.totals ??
    (coverage.data
      ? coverage.data.subjects.reduce<SubjectCoverage | null>(
          (sum, subject) =>
            sum === null
              ? { ...subject, label: 'All subjects' }
              : {
                  ...sum,
                  leaves: sum.leaves + subject.leaves,
                  read: sum.read + subject.read,
                  revised: sum.revised + subject.revised,
                  tested: sum.tested + subject.tested,
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

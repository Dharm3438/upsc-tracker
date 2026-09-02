import { useState } from 'react'
import { ListChecks, PenLine, Plus, Timer } from 'lucide-react'
import { Link, useSearchParams } from 'react-router-dom'

import type { Test } from '@/api/tests'
import { AnswerList } from '@/components/answers/AnswerList'
import { Sparkline, percent } from '@/components/charts/Sparkline'
import { TestSheet } from '@/components/tests/TestSheet'
import {
  Badge,
  Button,
  Card,
  CardFooter,
  CardHeader,
  EmptyState,
  LinkButton,
  PageHeader,
  QueryBoundary,
  SegmentedControl,
  SkeletonRows,
  StatTile,
} from '@/components/ui'
import { useTests } from '@/hooks/useTests'
import { formatDayIST } from '@/lib/date'

type Section = 'tests' | 'answers'

/**
 * Practice holds tests and answer writing. Which half is open lives in the URL,
 * the same way the Notes screen does it, so a link can point at either.
 */
export function Practice() {
  const [params, setParams] = useSearchParams()
  const section: Section = params.get('tab') === 'answers' ? 'answers' : 'tests'
  const [adding, setAdding] = useState(false)

  return (
    <>
      <PageHeader
        title="Practice"
        subtitle="Attempts and answers. The mistakes are worth more than the marks."
        actions={
          <>
            <SegmentedControl<Section>
              label="Practice section"
              value={section}
              onChange={(next) => setParams(next === 'answers' ? { tab: 'answers' } : {}, { replace: true })}
              options={[
                { value: 'tests', label: 'Tests', icon: <ListChecks size={15} strokeWidth={1.9} /> },
                { value: 'answers', label: 'Answers', icon: <PenLine size={15} strokeWidth={1.9} /> },
              ]}
            />
            {section === 'tests' ? (
              <Button
                variant="primary"
                icon={<Plus size={15} strokeWidth={2.2} />}
                onClick={() => setAdding(true)}
              >
                Add a test
              </Button>
            ) : (
              <LinkButton
                to="/practice/answers/new"
                variant="primary"
                icon={<Timer size={15} strokeWidth={2} />}
              >
                Start an answer
              </LinkButton>
            )}
          </>
        }
      />

      {section === 'tests' ? <Tests /> : <AnswerList />}

      {adding && <TestSheet onClose={() => setAdding(false)} />}
    </>
  )
}

function Tests() {
  const tests = useTests()
  const pages = tests.data?.pages ?? []
  const items = pages.flatMap((page) => page.items)
  const trend = pages[0]?.trend ?? []

  const scored = items.filter((test) => test.marks !== null)
  const average =
    items.length > 0 ? items.reduce((sum, test) => sum + test.accuracy, 0) / items.length : null
  const unrecorded = items.reduce(
    (sum, test) => sum + Math.max(0, test.wrong - test.mistakes_logged),
    0,
  )

  return (
    <>
      <div className="mb-4 grid grid-cols-2 gap-3 lg:mb-5 lg:grid-cols-4 lg:gap-5">
        <StatTile label="Attempts" value={items.length} loading={!tests.data} />
        <StatTile
          label="Average accuracy"
          value={percent(average)}
          loading={!tests.data}
          sub={trend.length > 1 ? `last ${trend.length} shown right` : undefined}
        />
        <StatTile
          label="Last score"
          loading={!tests.data}
          value={scored[0]?.marks ?? '—'}
          unit={scored[0]?.max_marks ? `/ ${scored[0].max_marks}` : undefined}
          sub={scored[0] && formatDayIST(scored[0].date)}
        />
        <StatTile
          label="Mistakes to record"
          value={unrecorded}
          tone={unrecorded > 0 ? 'danger' : 'success'}
          loading={!tests.data}
          sub={unrecorded > 0 ? 'wrong answers with nothing against them' : 'all caught up'}
        />
      </div>

      <Card>
        <CardHeader
          title="Attempts"
          count={items.length}
          icon={<ListChecks size={17} strokeWidth={1.8} />}
          action={
            trend.length > 1 && (
              <span className="flex items-center gap-3 text-muted">
                <span className="text-xs">Accuracy, last {trend.length}</span>
                <span className="text-sm tabular-nums text-ink">
                  {percent(trend[trend.length - 1])}
                </span>
                <span className="text-accent">
                  <Sparkline values={trend} width={120} height={28} />
                </span>
              </span>
            )
          }
        />

        {/* A real table from `md` up; the same fields stacked below it. */}
        <div className="hidden grid-cols-[1fr_120px_110px_90px_80px] gap-4 border-b border-hairline px-5 py-2 text-xs font-semibold uppercase tracking-[0.08em] text-faint md:grid">
          <span>Test</span>
          <span>Date</span>
          <span>Papers</span>
          <span className="text-right">Score</span>
          <span className="text-right">Accuracy</span>
        </div>

        <QueryBoundary
          query={tests}
          error="Could not load your attempts."
          skeleton={<SkeletonRows rows={5} />}
          isEmpty={() => items.length === 0}
          empty={
            <EmptyState
              icon={ListChecks}
              title="No tests yet."
              description="Add one after your next paper — the tag breakdown needs somewhere to start."
            />
          }
        >
          {() => (
            <ul className="divide-y divide-hairline">
              {items.map((test) => (
                <TestRow key={test._id} test={test} />
              ))}
            </ul>
          )}
        </QueryBoundary>

        {tests.hasNextPage && (
          <CardFooter className="p-0">
            <Button
              variant="ghost"
              full
              className="rounded-none"
              loading={tests.isFetchingNextPage}
              onClick={() => void tests.fetchNextPage()}
            >
              Show older attempts
            </Button>
          </CardFooter>
        )}
      </Card>
    </>
  )
}

function TestRow({ test }: { test: Test }) {
  // The nudge that matters on this row: wrong answers with nothing recorded
  // against them are the ones that teach her nothing.
  const unrecorded = test.wrong - test.mistakes_logged

  return (
    <li>
      <Link
        to={`/practice/tests/${test._id}`}
        className="flex min-h-tap items-center gap-3 px-4 py-2.5 transition-colors hover:bg-canvas sm:px-5 md:grid md:grid-cols-[1fr_120px_110px_90px_80px] md:gap-4"
      >
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-2">
            <span className="truncate text-sm font-medium text-ink">{test.title}</span>
            {unrecorded > 0 && (
              <Badge tone="danger" size="sm">
                {unrecorded} to record
              </Badge>
            )}
          </span>
          <span className="block truncate text-xs text-muted md:hidden">
            {formatDayIST(test.date)}
            {test.papers.length > 0 && ` · ${test.papers.join(', ')}`}
          </span>
        </span>

        <span className="hidden text-sm text-muted md:block">{formatDayIST(test.date)}</span>
        <span className="hidden truncate text-sm text-muted md:block">
          {test.papers.join(', ') || '—'}
        </span>

        <span className="shrink-0 text-right">
          <span className="block text-sm tabular-nums text-ink">
            {test.marks === null ? '—' : test.marks}
            {test.max_marks ? <span className="text-faint">/{test.max_marks}</span> : null}
          </span>
          <span className="block text-xs tabular-nums text-muted md:hidden">
            {percent(test.accuracy)}
          </span>
        </span>
        <span className="hidden text-right text-sm tabular-nums text-muted md:block">
          {percent(test.accuracy)}
        </span>
      </Link>
    </li>
  )
}

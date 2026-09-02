import { useState } from 'react'
import { Link } from 'react-router-dom'

import type { Test } from '@/api/tests'
import { EmptyState } from '@/components/EmptyState'
import { Sparkline, percent } from '@/components/charts/Sparkline'
import { Header } from '@/components/shell/Header'
import { TestSheet } from '@/components/tests/TestSheet'
import { useTests } from '@/hooks/useTests'
import { formatDayIST } from '@/lib/date'

/**
 * Practice holds tests and answer writing as a segmented control. Answers land
 * in phase 5; the control is here now so the tab does not change shape later.
 */
export function Practice() {
  const [section, setSection] = useState<'tests' | 'answers'>('tests')

  return (
    <>
      <Header title="Practice" />
      <div className="flex gap-2 px-4 pb-2">
        <Segment
          selected={section === 'tests'}
          onClick={() => setSection('tests')}
          label="Tests"
        />
        <Segment
          selected={section === 'answers'}
          onClick={() => setSection('answers')}
          label="Answers"
        />
      </div>

      {section === 'tests' ? (
        <Tests />
      ) : (
        <EmptyState>Answer writing arrives in phase 5.</EmptyState>
      )}
    </>
  )
}

function Tests() {
  const [adding, setAdding] = useState(false)
  const tests = useTests()

  const pages = tests.data?.pages ?? []
  const items = pages.flatMap((page) => page.items)
  const trend = pages[0]?.trend ?? []

  return (
    <>
      {trend.length > 1 && (
        <div className="flex items-center justify-between px-4 pb-3 text-slate">
          <span className="text-xs">Accuracy, last {trend.length}</span>
          <div className="flex items-center gap-3">
            <span className="text-sm tabular-nums text-ink">
              {percent(trend[trend.length - 1])}
            </span>
            <span className="text-signal">
              <Sparkline values={trend} />
            </span>
          </div>
        </div>
      )}

      <div className="border-y border-line bg-surface">
        {tests.isError && <EmptyState>Could not load your attempts.</EmptyState>}
        {!tests.data && !tests.isError && <EmptyState>Loading…</EmptyState>}
        {items.length === 0 && tests.data && (
          <EmptyState>
            No tests yet. Add one after your next paper — the tag breakdown needs
            somewhere to start.
          </EmptyState>
        )}
        {items.map((test) => (
          <TestRow key={test._id} test={test} />
        ))}
      </div>

      {tests.hasNextPage && (
        <button
          type="button"
          onClick={() => void tests.fetchNextPage()}
          disabled={tests.isFetchingNextPage}
          className="h-tap w-full text-sm text-signal"
        >
          {tests.isFetchingNextPage ? 'Loading…' : 'Show older attempts'}
        </button>
      )}

      <div className="p-4">
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="h-tap w-full rounded border border-line bg-surface text-sm font-medium text-signal"
        >
          Add a test
        </button>
      </div>

      {adding && <TestSheet onClose={() => setAdding(false)} />}
    </>
  )
}

function TestRow({ test }: { test: Test }) {
  // The nudge that matters on this row: wrong answers with nothing recorded
  // against them are the ones that teach her nothing.
  const unrecorded = test.wrong - test.mistakes_logged

  return (
    <Link
      to={`/practice/tests/${test._id}`}
      className="flex min-h-tap items-center gap-3 border-b border-line px-4 py-2.5 last:border-0"
    >
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm">{test.title}</p>
        <p className="truncate text-xs text-slate">
          {formatDayIST(test.date)}
          {test.papers.length > 0 && ` · ${test.papers.join(', ')}`}
          {unrecorded > 0 && ` · ${unrecorded} to record`}
        </p>
      </div>
      <div className="shrink-0 text-right">
        <p className="text-sm tabular-nums">
          {test.marks === null ? '—' : test.marks}
          {test.max_marks ? (
            <span className="text-slate">/{test.max_marks}</span>
          ) : null}
        </p>
        <p className="text-xs tabular-nums text-slate">{percent(test.accuracy)}</p>
      </div>
    </Link>
  )
}

function Segment({
  selected,
  onClick,
  label,
}: {
  selected: boolean
  onClick: () => void
  label: string
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={[
        'h-9 flex-1 rounded-full border text-sm',
        selected ? 'border-signal bg-signal text-surface' : 'border-line text-slate',
      ].join(' ')}
    >
      {label}
    </button>
  )
}

import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'

import { EmptyState } from '@/components/EmptyState'
import { percent } from '@/components/charts/Sparkline'
import { MistakeEntry } from '@/components/mistakes/MistakeEntry'
import { MistakeList } from '@/components/mistakes/MistakeList'
import { TestSheet } from '@/components/tests/TestSheet'
import { toast } from '@/components/shell/Toast'
import { useMistakes } from '@/hooks/useMistakes'
import { useDeleteTest, useTest } from '@/hooks/useTests'
import { formatDayIST } from '@/lib/date'
import { readable } from '@/lib/errors'

export function TestDetail() {
  const { testId } = useParams()
  const navigate = useNavigate()
  const test = useTest(testId)
  const mistakes = useMistakes({ sourceId: testId })
  const remove = useDeleteTest()

  const [editing, setEditing] = useState(false)
  const [adding, setAdding] = useState(false)

  if (test.isError) return <EmptyState>Could not load that attempt.</EmptyState>
  if (!test.data) return <EmptyState>Loading…</EmptyState>

  const attempt = test.data
  const unrecorded = attempt.wrong - attempt.mistakes_logged

  return (
    <>
      <header className="flex min-h-tap items-center justify-between px-4">
        <button type="button" onClick={() => navigate(-1)} className="text-sm text-signal">
          ‹ Practice
        </button>
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="text-sm text-slate"
        >
          Edit
        </button>
      </header>

      <div className="px-4 pb-4">
        <h1 className="text-lg font-medium">{attempt.title}</h1>
        <p className="mt-1 text-sm text-slate">
          {formatDayIST(attempt.date)}
          {attempt.papers.length > 0 && ` · ${attempt.papers.join(', ')}`}
          {attempt.duration_minutes ? ` · ${attempt.duration_minutes} min` : ''}
        </p>
      </div>

      <Section label="Score">
        <Row
          label="Marks"
          value={
            attempt.marks === null
              ? '—'
              : `${attempt.marks}${attempt.max_marks ? ` / ${attempt.max_marks}` : ''}`
          }
        />
        <Row label="Accuracy" value={percent(attempt.accuracy)} />
        <Row
          label="Questions"
          value={`${attempt.correct} right · ${attempt.wrong} wrong · ${attempt.skipped} left`}
        />
        <Row
          label="Attempted"
          value={`${attempt.attempted} of ${attempt.total_questions}`}
        />
      </Section>

      <section className="mt-6">
        <div className="flex items-baseline justify-between px-4 pb-2">
          <h2 className="text-xs uppercase tracking-wide text-slate">Mistakes</h2>
          <span className="text-sm tabular-nums text-slate">
            {attempt.mistakes_logged}
            {unrecorded > 0 && <span className="text-overdue"> · {unrecorded} to go</span>}
          </span>
        </div>
        <div className="border-y border-line bg-surface">
          <MistakeList
            query={mistakes}
            empty="Nothing recorded yet. The patterns are more useful than the score."
            showTopic
          />
        </div>
      </section>

      {attempt.notes && (
        <Section label="Notes">
          <p className="px-4 py-3 text-sm">{attempt.notes}</p>
        </Section>
      )}

      <div className="space-y-3 p-4">
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="h-tap w-full rounded border border-signal text-sm font-medium text-signal"
        >
          Add mistakes
        </button>
        <button
          type="button"
          onClick={() => {
            if (!window.confirm('Delete this attempt and its mistakes?')) return
            remove.mutate(attempt._id, {
              onSuccess: () => {
                toast('Attempt deleted.')
                navigate('/practice')
              },
              onError: (caught) => toast(readable(caught)),
            })
          }}
          className="h-tap w-full text-sm text-slate"
        >
          Delete attempt
        </button>
      </div>

      {editing && <TestSheet existing={attempt} onClose={() => setEditing(false)} />}
      {adding && (
        <MistakeEntry
          testId={attempt._id}
          wrong={attempt.wrong}
          alreadyLogged={attempt.mistakes_logged}
          onClose={() => setAdding(false)}
        />
      )}
    </>
  )
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <section className="mt-6">
      <h2 className="px-4 pb-2 text-xs uppercase tracking-wide text-slate">{label}</h2>
      <div className="border-y border-line bg-surface">{children}</div>
    </section>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex min-h-tap items-center justify-between gap-3 border-b border-line px-4 py-2 last:border-0">
      <span className="text-sm text-slate">{label}</span>
      <span className="text-sm tabular-nums">{value}</span>
    </div>
  )
}

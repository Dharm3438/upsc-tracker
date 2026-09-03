import { useState } from 'react'

import type { WeeklyReview } from '@/api/settings'
import { toast } from '@/components/shell/Toast'
import { Button, Field, Textarea } from '@/components/ui'
import { useSaveWeeklyReview, useWeeklyReviews } from '@/hooks/useSettings'
import { formatDayIST, weekStartIST } from '@/lib/date'

const PROMPTS = [
  { field: 'what_slipped', label: 'What slipped?' },
  { field: 'what_to_replan', label: 'What needs replanning?' },
  { field: 'one_change', label: 'One change for next week' },
] as const

type Field = (typeof PROMPTS)[number]['field']

/**
 * Three prompts, saved with a snapshot of the week's numbers. The snapshot is
 * the server's and is taken once: the history is meant to say what the week
 * looked like at the time, not what it looks like from here.
 *
 * Rewriting the same week edits the note and keeps the original numbers.
 */
export function WeeklyReviewCard() {
  const week = weekStartIST()
  const reviews = useWeeklyReviews()
  const save = useSaveWeeklyReview()

  const current = reviews.data?.find((review) => review.week_start === week)
  const [draft, setDraft] = useState<Record<Field, string> | null>(null)
  const values =
    draft ??
    ({
      what_slipped: current?.what_slipped ?? '',
      what_to_replan: current?.what_to_replan ?? '',
      one_change: current?.one_change ?? '',
    } as Record<Field, string>)

  const dirty = draft !== null
  const empty = PROMPTS.every(({ field }) => values[field].trim() === '')

  function submit() {
    save.mutate(
      { week_start: week, ...values },
      {
        onSuccess: () => {
          setDraft(null)
          toast('Week saved.')
        },
        onError: () => toast('Could not save that.', 'error'),
      },
    )
  }

  return (
    <div className="grid gap-4 p-4 sm:p-5 lg:grid-cols-5 lg:gap-6">
      <div className="space-y-3.5 lg:col-span-3">
        <p className="text-xs font-semibold uppercase tracking-[0.08em] text-faint">
          Week of {formatDayIST(week)}
        </p>

        {PROMPTS.map(({ field, label }) => (
          <Field key={field} label={label}>
            <Textarea
              value={values[field]}
              onChange={(event) =>
                setDraft({ ...values, [field]: event.target.value } as Record<Field, string>)
              }
              rows={2}
            />
          </Field>
        ))}

        <Button
          variant="primary"
          onClick={submit}
          loading={save.isPending}
          disabled={empty || (!dirty && current !== undefined)}
        >
          {current ? 'Save the week again' : 'Save the week'}
        </Button>
      </div>

      <div className="lg:col-span-2">
        {current ? (
          <Snapshot review={current} />
        ) : (
          <p className="rounded-lg border border-dashed border-hairline p-4 text-sm text-muted">
            The week's numbers are snapshotted when you save, and kept as they were. Past weeks
            live in Settings.
          </p>
        )}
      </div>
    </div>
  )
}

/** What the week actually held, as recorded when the note was written. */
function Snapshot({ review }: { review: WeeklyReview }) {
  const figures = [
    ['Topics', review.nodes_covered],
    ['Revisions', review.nodes_revised],
    ['Answers', review.answers_written],
    [
      'Accuracy',
      review.avg_accuracy === null ? '—' : `${Math.round(review.avg_accuracy * 100)}%`,
    ],
  ] as const

  return (
    <dl className="grid grid-cols-2 gap-3 rounded-lg border border-hairline bg-canvas p-4">
      {figures.map(([label, value]) => (
        <div key={label}>
          <dt className="text-xs font-semibold uppercase tracking-[0.08em] text-faint">
            {label}
          </dt>
          <dd className="font-display text-2xl font-semibold tabular-nums text-ink">{value}</dd>
        </div>
      ))}
    </dl>
  )
}

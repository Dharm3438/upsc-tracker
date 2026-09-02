import { useState } from 'react'

import type { WeeklyReview } from '@/api/settings'
import { toast } from '@/components/shell/Toast'
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
        onError: () => toast('Could not save that.'),
      },
    )
  }

  return (
    <div className="mx-4 rounded-lg border border-line bg-surface p-4">
      <p className="pb-3 text-xs text-slate">Week of {formatDayIST(week)}</p>

      {PROMPTS.map(({ field, label }) => (
        <label key={field} className="block pb-3">
          <span className="text-sm">{label}</span>
          <textarea
            value={values[field]}
            onChange={(event) =>
              setDraft({ ...values, [field]: event.target.value } as Record<Field, string>)
            }
            rows={2}
            className="mt-1 w-full resize-none rounded border border-line bg-surface px-3 py-2 text-sm focus:border-signal"
          />
        </label>
      ))}

      <button
        type="button"
        onClick={submit}
        disabled={save.isPending || empty || (!dirty && current !== undefined)}
        className="h-tap w-full rounded border border-signal text-sm font-medium text-signal disabled:border-line disabled:text-slate"
      >
        {current ? 'Save the week again' : 'Save the week'}
      </button>

      {current && <Snapshot review={current} />}
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
    <dl className="mt-4 grid grid-cols-4 gap-2 border-t border-line pt-3">
      {figures.map(([label, value]) => (
        <div key={label}>
          <dt className="text-xs text-slate">{label}</dt>
          <dd className="text-sm tabular-nums">{value}</dd>
        </div>
      ))}
    </dl>
  )
}

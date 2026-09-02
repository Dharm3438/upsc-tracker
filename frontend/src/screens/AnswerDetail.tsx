import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'

import { scoreRatio, type Answer } from '@/api/answers'
import { EmptyState } from '@/components/EmptyState'
import { percent } from '@/components/charts/Sparkline'
import { toast } from '@/components/shell/Toast'
import { useAnswer, useDeleteAnswer, useUpdateAnswer } from '@/hooks/useAnswers'
import { formatDayIST } from '@/lib/date'
import { readable } from '@/lib/errors'

/**
 * One attempt in full. The screen exists mainly for the two things the timer
 * cannot finish: scoring an answer she had not marked yet, and reading back
 * what she said she would fix.
 */
export function AnswerDetail() {
  const { answerId } = useParams()
  const navigate = useNavigate()
  const answer = useAnswer(answerId)
  const update = useUpdateAnswer(answerId ?? '')
  const remove = useDeleteAnswer()

  if (answer.isError) return <EmptyState>Could not load that answer.</EmptyState>
  if (!answer.data) return <EmptyState>Loading…</EmptyState>

  const item = answer.data
  const ratio = scoreRatio(item)

  return (
    <>
      <header className="flex min-h-tap items-center justify-between px-4">
        <button type="button" onClick={() => navigate(-1)} className="text-sm text-signal">
          ‹ Practice
        </button>
        {item.review_due && !item.reviewed && (
          <Link
            to={`/practice/answers/new?redo=${item._id}`}
            className="text-sm text-signal"
          >
            Rewrite
          </Link>
        )}
      </header>

      <div className="px-4 pb-4">
        <p className="whitespace-pre-wrap text-sm">{item.question}</p>
        <p className="mt-2 text-xs text-slate">
          {formatDayIST(item.date)} · {item.paper}
          {item.node_title ? ` · ${item.node_title}` : ''}
        </p>
      </div>

      <Section label="How it went">
        <Row
          label="Self-score"
          value={
            item.self_score === null
              ? 'Not marked yet'
              : `${item.self_score} / ${item.marks_allotted}${
                  ratio === null ? '' : ` · ${percent(ratio)}`
                }`
          }
        />
        <Row
          label="Time"
          value={item.minutes_taken === null ? '—' : `${item.minutes_taken} min`}
        />
        <Row
          label="Words"
          value={
            item.words_written === null
              ? '—'
              : `${item.words_written}${item.word_limit ? ` of ${item.word_limit}` : ''}`
          }
        />
      </Section>

      {item.review_due && (
        <p className="px-4 pt-3 text-sm text-slate">
          {item.reviewed
            ? 'Rewritten.'
            : `Scored under half — back in the redo queue on ${formatDayIST(item.review_due)}.`}
        </p>
      )}

      <ScoreCard answer={item} onSave={(body) => update.mutate(body)} saving={update.isPending} />

      {item.improvements && (
        <Section label="To fix next time">
          <p className="whitespace-pre-wrap px-4 py-3 text-sm">{item.improvements}</p>
        </Section>
      )}

      {item.text && (
        <Section label="What she wrote">
          <p className="whitespace-pre-wrap px-4 py-3 text-sm">{item.text}</p>
        </Section>
      )}

      {item.image_urls.length > 0 && (
        <Section label="The sheet">
          {item.image_urls.map((url) => (
            <a
              key={url}
              href={url}
              target="_blank"
              rel="noreferrer"
              className="flex min-h-tap items-center border-b border-line px-4 text-sm text-signal last:border-0"
            >
              Open the photograph
            </a>
          ))}
        </Section>
      )}

      <div className="space-y-3 p-4">
        {item.review_due && !item.reviewed && (
          <button
            type="button"
            onClick={() =>
              update.mutate(
                { reviewed: true },
                { onSuccess: () => toast('Cleared from the redo queue.') },
              )
            }
            className="h-tap w-full rounded border border-line bg-surface text-sm text-slate"
          >
            Clear from the redo queue
          </button>
        )}
        <button
          type="button"
          onClick={() => {
            if (!window.confirm('Delete this answer?')) return
            remove.mutate(item._id, {
              onSuccess: () => {
                toast('Answer deleted.')
                navigate('/practice')
              },
              onError: (caught) => toast(readable(caught)),
            })
          }}
          className="h-tap w-full text-sm text-slate"
        >
          Delete answer
        </button>
      </div>
    </>
  )
}

/** Scoring an answer marked later — the common case for anything written on
 *  paper and handed to a peer. */
function ScoreCard({
  answer,
  onSave,
  saving,
}: {
  answer: Answer
  onSave: (body: { self_score: number; improvements?: string }) => void
  saving: boolean
}) {
  const [open, setOpen] = useState(false)
  const [score, setScore] = useState(
    answer.self_score === null ? '' : String(answer.self_score),
  )
  const [error, setError] = useState<string | null>(null)

  if (!open) {
    return (
      <div className="p-4">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="h-tap w-full rounded border border-signal text-sm font-medium text-signal"
        >
          {answer.self_score === null ? 'Score it' : 'Change the score'}
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-3 p-4">
      <p className="text-xs text-slate">Out of {answer.marks_allotted}</p>
      <input
        inputMode="decimal"
        value={score}
        onChange={(event) => setScore(event.target.value.replace(/[^\d.]/g, ''))}
        placeholder="7.5"
        className="h-tap w-full rounded border border-line px-3 text-sm tabular-nums focus:border-signal"
      />
      {error && <p className="text-sm text-overdue">{error}</p>}
      <button
        type="button"
        disabled={saving}
        onClick={() => {
          const parsed = Number.parseFloat(score)
          if (!Number.isFinite(parsed)) return setError('Give it a number.')
          if (parsed > answer.marks_allotted) {
            return setError(`Out of ${answer.marks_allotted}.`)
          }
          setError(null)
          onSave({ self_score: parsed })
          setOpen(false)
        }}
        className="h-tap w-full rounded bg-signal text-sm font-medium text-surface disabled:opacity-60"
      >
        {saving ? 'Saving…' : 'Save the score'}
      </button>
    </div>
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

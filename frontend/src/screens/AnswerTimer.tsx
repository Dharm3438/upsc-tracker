import { useEffect, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'

import type { NewAnswer } from '@/api/answers'
import { NodePicker, type PickedNode } from '@/components/log/NodePicker'
import { toast } from '@/components/shell/Toast'
import { useAnswer, useCreateAnswer, useUpdateAnswer } from '@/hooks/useAnswers'
import { todayIST } from '@/lib/date'
import { readable } from '@/lib/errors'

const MARKS = [10, 15, 20, 125]
const WORD_LIMITS = [150, 250, 1000]
const DRAFT_KEY = 'upsc.answerDraft'

type Stage = 'setup' | 'writing' | 'scoring'

/** What survives a locked phone: the clock is stored as timestamps, so time
 *  keeps passing while the tab is asleep and the count is still right. */
type Draft = {
  node: PickedNode | null
  question: string
  marks: number
  wordLimit: number
  startedAt: number | null
  accumulatedMs: number
  stage: Stage
}

const EMPTY: Draft = {
  node: null,
  question: '',
  marks: 15,
  wordLimit: 250,
  startedAt: null,
  accumulatedMs: 0,
  stage: 'setup',
}

function loadDraft(): Draft {
  try {
    const stored = localStorage.getItem(DRAFT_KEY)
    return stored ? { ...EMPTY, ...(JSON.parse(stored) as Draft) } : EMPTY
  } catch {
    return EMPTY
  }
}

/**
 * The timer view of plan §8.5. A full screen rather than a sheet: she sits in
 * it for nine minutes, and a stray tap on a backdrop should not end that.
 *
 * The draft is written to localStorage on every change, because an answer
 * interrupted by a phone call and a locked screen is the normal case, not the
 * edge case.
 */
export function AnswerTimer() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const redoOf = params.get('redo') ?? undefined
  const original = useAnswer(redoOf)

  const [draft, setDraft] = useState<Draft>(loadDraft)
  const [words, setWords] = useState('')
  const [score, setScore] = useState('')
  const [improvements, setImprovements] = useState('')
  const [error, setError] = useState<string | null>(null)
  const create = useCreateAnswer()
  const closeRedo = useUpdateAnswer(redoOf ?? '')

  // Rewriting an answer starts from the same question and the same marks.
  const seeded = useRef(false)
  useEffect(() => {
    if (!original.data || seeded.current) return
    seeded.current = true
    setDraft((current) =>
      current.question
        ? current
        : {
            ...current,
            question: original.data.question,
            marks: original.data.marks_allotted,
            wordLimit: original.data.word_limit ?? current.wordLimit,
            node: original.data.node_title
              ? {
                  id: original.data.node_id,
                  title: original.data.node_title,
                  path: original.data.node_path ?? '',
                }
              : current.node,
          },
    )
  }, [original.data])

  useEffect(() => {
    localStorage.setItem(DRAFT_KEY, JSON.stringify(draft))
  }, [draft])

  const elapsedMs = useElapsed(draft.startedAt, draft.accumulatedMs)
  const minutes = Math.max(1, Math.round(elapsedMs / 60_000))
  const patch = (changes: Partial<Draft>) => setDraft((current) => ({ ...current, ...changes }))

  function start() {
    if (!draft.node) return setError('Which topic is this question on?')
    if (!draft.question.trim()) return setError('Paste or type the question first.')
    setError(null)
    patch({ stage: 'writing', startedAt: Date.now() })
  }

  function stop() {
    patch({
      stage: 'scoring',
      startedAt: null,
      accumulatedMs: draft.accumulatedMs + (draft.startedAt ? Date.now() - draft.startedAt : 0),
    })
  }

  function save() {
    const parsedScore = decimal(score)
    if (parsedScore !== null && parsedScore > draft.marks) {
      return setError(`Out of ${draft.marks}.`)
    }
    setError(null)

    const body: NewAnswer = {
      date: todayIST(),
      node_id: draft.node!.id,
      question: draft.question.trim(),
      marks_allotted: draft.marks,
      word_limit: draft.wordLimit,
      words_written: whole(words),
      minutes_taken: minutes,
      self_score: parsedScore,
      improvements: improvements.trim(),
    }

    create.mutate(body, {
      onSuccess: (saved) => {
        localStorage.removeItem(DRAFT_KEY)
        // The rewrite is what closes the original off; a redo queue that still
        // listed it would ask for the same answer twice.
        if (redoOf) closeRedo.mutate({ reviewed: true })
        toast(
          saved.review_due
            ? 'Saved. Back in the redo queue in 30 days.'
            : 'Answer saved.',
        )
        navigate(`/practice/answers/${saved._id}`, { replace: true })
      },
      onError: (caught) => setError(readable(caught)),
    })
  }

  function discard() {
    if (draft.stage !== 'setup' && !window.confirm('Throw this attempt away?')) return
    localStorage.removeItem(DRAFT_KEY)
    navigate('/practice')
  }

  return (
    <>
      <header className="flex min-h-tap items-center justify-between px-4">
        <button type="button" onClick={discard} className="text-sm text-signal">
          ‹ Practice
        </button>
        {draft.stage !== 'setup' && (
          <span className="text-sm tabular-nums text-slate">{clock(elapsedMs)}</span>
        )}
      </header>

      {draft.stage === 'setup' && (
        <div className="space-y-4 p-4">
          <Field label="Question">
            <textarea
              value={draft.question}
              onChange={(event) => patch({ question: event.target.value })}
              rows={4}
              placeholder="Cooperative federalism is a means, not an end. Comment."
              className="w-full rounded border border-line p-3 text-sm focus:border-signal"
            />
          </Field>

          <Field label="Topic">
            <NodePicker value={draft.node} onChange={(node) => patch({ node })} />
          </Field>

          <div className="flex gap-3">
            <Field label="Marks" className="flex-1">
              <div className="flex flex-wrap gap-2">
                {MARKS.map((option) => (
                  <Chip
                    key={option}
                    selected={draft.marks === option}
                    onClick={() => patch({ marks: option })}
                  >
                    {option}
                  </Chip>
                ))}
              </div>
            </Field>
          </div>

          <Field label="Word limit">
            <div className="flex flex-wrap gap-2">
              {WORD_LIMITS.map((option) => (
                <Chip
                  key={option}
                  selected={draft.wordLimit === option}
                  onClick={() => patch({ wordLimit: option })}
                >
                  {option}
                </Chip>
              ))}
            </div>
          </Field>

          {error && <p className="text-sm text-overdue">{error}</p>}

          <button
            type="button"
            onClick={start}
            className="h-tap w-full rounded bg-signal text-sm font-medium text-surface"
          >
            Start writing
          </button>
        </div>
      )}

      {draft.stage === 'writing' && (
        <div className="p-4">
          <p className="whitespace-pre-wrap text-sm">{draft.question}</p>
          <p className="mt-1 text-xs text-slate">
            {draft.marks} marks · {draft.wordLimit} words · {draft.node?.title}
          </p>

          <p className="py-10 text-center text-5xl font-light tabular-nums">
            {clock(elapsedMs)}
          </p>

          <div className="space-y-3">
            <button
              type="button"
              onClick={stop}
              className="h-tap w-full rounded bg-signal text-sm font-medium text-surface"
            >
              Done writing
            </button>
            <button
              type="button"
              onClick={() =>
                draft.startedAt
                  ? patch({
                      startedAt: null,
                      accumulatedMs: draft.accumulatedMs + (Date.now() - draft.startedAt),
                    })
                  : patch({ startedAt: Date.now() })
              }
              className="h-tap w-full text-sm text-slate"
            >
              {draft.startedAt ? 'Pause' : 'Resume'}
            </button>
          </div>
        </div>
      )}

      {draft.stage === 'scoring' && (
        <div className="space-y-4 p-4">
          <p className="text-sm text-slate">
            {minutes} min{minutes === 1 ? '' : 's'} on {draft.marks} marks.
          </p>

          <div className="flex gap-3">
            <Field label="Words written" className="flex-1">
              <NumberInput value={words} onChange={setWords} placeholder={String(draft.wordLimit)} />
            </Field>
            <Field label={`Self-score / ${draft.marks}`} className="flex-1">
              <NumberInput value={score} onChange={setScore} placeholder="7.5" decimals />
            </Field>
          </div>

          <p className="text-xs text-slate">
            Under half comes back in 30 days. Leave it blank if you have not
            marked it yet — you can score it from the answer later.
          </p>

          <Field label="What to fix next time">
            <textarea
              value={improvements}
              onChange={(event) => setImprovements(event.target.value)}
              rows={3}
              placeholder="Intro too long; no Article 246 anywhere; ran out of time on the way forward."
              className="w-full rounded border border-line p-3 text-sm focus:border-signal"
            />
          </Field>

          {error && <p className="text-sm text-overdue">{error}</p>}

          <button
            type="button"
            onClick={save}
            disabled={create.isPending}
            className="h-tap w-full rounded bg-signal text-sm font-medium text-surface disabled:opacity-60"
          >
            {create.isPending ? 'Saving…' : 'Save answer'}
          </button>
          <button
            type="button"
            onClick={() => patch({ stage: 'writing', startedAt: Date.now() })}
            className="h-tap w-full text-sm text-slate"
          >
            Back to the clock
          </button>
        </div>
      )}
    </>
  )
}

/** Elapsed milliseconds, ticking once a second while the clock runs.
 *
 *  Derived from a start timestamp rather than counted up, so a backgrounded
 *  tab — which browsers throttle to one tick a minute — still comes back with
 *  the right number. */
function useElapsed(startedAt: number | null, accumulatedMs: number): number {
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    if (startedAt === null) return
    setNow(Date.now())
    const timer = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [startedAt])

  return accumulatedMs + (startedAt === null ? 0 : Math.max(0, now - startedAt))
}

function clock(ms: number): string {
  const total = Math.floor(ms / 1000)
  const mins = Math.floor(total / 60)
  return `${mins}:${String(total % 60).padStart(2, '0')}`
}

function whole(value: string): number | null {
  const parsed = Number.parseInt(value, 10)
  return Number.isFinite(parsed) ? parsed : null
}

function decimal(value: string): number | null {
  const parsed = Number.parseFloat(value)
  return Number.isFinite(parsed) ? parsed : null
}

function Field({
  label,
  className,
  children,
}: {
  label: string
  className?: string
  children: React.ReactNode
}) {
  return (
    <div className={className}>
      <p className="pb-1.5 text-xs text-slate">{label}</p>
      {children}
    </div>
  )
}

function Chip({
  selected,
  onClick,
  children,
}: {
  selected: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={[
        'h-9 shrink-0 rounded-full border px-3 text-sm',
        selected ? 'border-signal bg-signal text-surface' : 'border-line text-slate',
      ].join(' ')}
    >
      {children}
    </button>
  )
}

function NumberInput({
  value,
  onChange,
  placeholder,
  decimals = false,
}: {
  value: string
  onChange: (value: string) => void
  placeholder: string
  decimals?: boolean
}) {
  return (
    <input
      inputMode={decimals ? 'decimal' : 'numeric'}
      value={value}
      onChange={(event) =>
        onChange(event.target.value.replace(decimals ? /[^\d.]/g : /\D/g, ''))
      }
      placeholder={placeholder}
      className="h-tap w-full min-w-0 rounded border border-line px-3 text-sm tabular-nums focus:border-signal"
    />
  )
}

import { useEffect, useRef, useState } from 'react'
import { ChevronLeft, Pause, Play, Timer } from 'lucide-react'
import { useNavigate, useSearchParams } from 'react-router-dom'

import type { NewAnswer } from '@/api/answers'
import { NodePicker, type PickedNode } from '@/components/log/NodePicker'
import { toast } from '@/components/shell/Toast'
import {
  Badge,
  Button,
  Callout,
  Card,
  CardBody,
  CardHeader,
  Chip,
  Field,
  NumberInput,
  Textarea,
} from '@/components/ui'
import { useAnswer, useCreateAnswer, useUpdateAnswer } from '@/hooks/useAnswers'
import { cn } from '@/lib/cn'
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
      <header className="mx-auto mb-5 flex max-w-3xl items-center justify-between">
        <button
          type="button"
          onClick={discard}
          className="inline-flex items-center gap-1 text-sm text-muted transition-colors hover:text-accent"
        >
          <ChevronLeft size={15} strokeWidth={2} />
          Practice
        </button>
        {draft.stage !== 'setup' && (
          <Badge tone="accent" icon={<Timer size={12} strokeWidth={2.2} />}>
            {clock(elapsedMs)}
          </Badge>
        )}
      </header>

      {draft.stage === 'setup' && (
        <Card className="mx-auto max-w-3xl">
          <CardHeader
            title="Answer practice"
            subtitle="Set it up, then the clock takes the screen."
            icon={<Timer size={17} strokeWidth={1.8} />}
          />
          <CardBody className="space-y-4">
            <Field label="Question">
              <Textarea
                value={draft.question}
                onChange={(event) => patch({ question: event.target.value })}
                rows={4}
                placeholder="Cooperative federalism is a means, not an end. Comment."
              />
            </Field>

            <Field label="Topic">
              <NodePicker value={draft.node} onChange={(node) => patch({ node })} />
            </Field>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Marks">
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
            </div>

            {error && <Callout tone="danger">{error}</Callout>}

            <Button variant="primary" size="lg" full onClick={start}>
              Start writing
            </Button>
          </CardBody>
        </Card>
      )}

      {draft.stage === 'writing' && (
        // The clock is the screen. Nothing else on it competes for a glance.
        <div className="mx-auto flex min-h-[68dvh] max-w-3xl flex-col items-center justify-center rounded-2xl bg-navy px-6 py-10 text-center text-white shadow-card sm:px-10">
          <p className="max-w-prose whitespace-pre-wrap font-display text-lg leading-snug text-white/90 lg:text-2xl">
            {draft.question}
          </p>
          <p className="mt-3 text-sm text-white/45">
            {draft.marks} marks · {draft.wordLimit} words · {draft.node?.title}
          </p>

          <p
            className={cn(
              'py-10 font-display text-6xl font-light tabular-nums lg:py-14 lg:text-[104px] lg:leading-none',
              draft.startedAt === null && 'text-white/40',
            )}
          >
            {clock(elapsedMs)}
          </p>

          {/* Pace against a rough minute-a-mark-and-a-bit. Over is not a
              failure, but it is the thing worth knowing before the bell. */}
          <div className="mb-8 h-1 w-full max-w-sm overflow-hidden rounded-full bg-white/15">
            <div
              className={cn(
                'h-full rounded-full transition-[width] duration-1000',
                elapsedMs > draft.marks * 72_000 ? 'bg-accent' : 'bg-white/60',
              )}
              style={{ width: `${Math.min(100, (elapsedMs / (draft.marks * 72_000)) * 100)}%` }}
            />
          </div>

          <div className="grid w-full max-w-sm gap-3 sm:grid-cols-2">
            <Button variant="primary" size="lg" full className="sm:order-2" onClick={stop}>
              Done writing
            </Button>
            <Button
              variant="onDark"
              size="lg"
              full
              icon={
                draft.startedAt ? (
                  <Pause size={16} strokeWidth={2} />
                ) : (
                  <Play size={16} strokeWidth={2} />
                )
              }
              onClick={() =>
                draft.startedAt
                  ? patch({
                      startedAt: null,
                      accumulatedMs: draft.accumulatedMs + (Date.now() - draft.startedAt),
                    })
                  : patch({ startedAt: Date.now() })
              }
            >
              {draft.startedAt ? 'Pause' : 'Resume'}
            </Button>
          </div>
        </div>
      )}

      {draft.stage === 'scoring' && (
        <Card className="mx-auto max-w-3xl">
          <CardHeader
            title="How did that go?"
            subtitle={`${minutes} min${minutes === 1 ? '' : 's'} on ${draft.marks} marks.`}
          />
          <CardBody className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Words written">
                <NumberInput
                  value={words}
                  onChange={setWords}
                  placeholder={String(draft.wordLimit)}
                />
              </Field>
              <Field label="Self-score" hint={`out of ${draft.marks}`}>
                <NumberInput value={score} onChange={setScore} placeholder="7.5" decimals />
              </Field>
            </div>

            <p className="text-xs text-muted">
              Under half comes back in 30 days. Leave it blank if you have not marked it yet —
              you can score it from the answer later.
            </p>

            <Field label="What to fix next time">
              <Textarea
                value={improvements}
                onChange={(event) => setImprovements(event.target.value)}
                rows={3}
                placeholder="Intro too long; no Article 246 anywhere; ran out of time on the way forward."
              />
            </Field>

            {error && <Callout tone="danger">{error}</Callout>}

            <div className="grid gap-3 sm:grid-cols-2">
              <Button
                variant="primary"
                size="lg"
                full
                className="sm:order-2"
                loading={create.isPending}
                onClick={save}
              >
                Save answer
              </Button>
              <Button
                variant="secondary"
                size="lg"
                full
                onClick={() => patch({ stage: 'writing', startedAt: Date.now() })}
              >
                Back to the clock
              </Button>
            </div>
          </CardBody>
        </Card>
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

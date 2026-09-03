import { useState } from 'react'
import { CheckCheck, ExternalLink, Image, RotateCcw, Sparkles, Trash2 } from 'lucide-react'
import { useNavigate, useParams } from 'react-router-dom'

import { scoreRatio } from '@/api/answers'
import { percent } from '@/components/charts/Sparkline'
import { toast } from '@/components/shell/Toast'
import {
  Badge,
  Button,
  Callout,
  Card,
  CardBody,
  CardHeader,
  ErrorState,
  Field,
  LinkButton,
  NumberInput,
  PageHeader,
  SkeletonText,
  StatTile,
} from '@/components/ui'
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

  const [score, setScore] = useState('')
  const [scoring, setScoring] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (answer.isError) {
    return (
      <Card>
        <ErrorState title="Could not load that answer." onRetry={answer.refetch} />
      </Card>
    )
  }
  if (!answer.data) {
    return (
      <Card>
        <CardBody>
          <SkeletonText lines={5} />
        </CardBody>
      </Card>
    )
  }

  const item = answer.data
  const ratio = scoreRatio(item)

  function saveScore() {
    const parsed = Number.parseFloat(score)
    if (!Number.isFinite(parsed)) return setError('Give it a number.')
    if (parsed > item.marks_allotted) return setError(`Out of ${item.marks_allotted}.`)
    setError(null)
    update.mutate(
      { self_score: parsed },
      {
        onSuccess: () => {
          toast('Score saved.')
          setScoring(false)
        },
        onError: (caught) => setError(readable(caught)),
      },
    )
  }

  return (
    <>
      <PageHeader
        back={{ label: 'Practice', to: '/practice' }}
        eyebrow={`${formatDayIST(item.date)} · ${item.subject}`}
        title={<span className="text-xl lg:text-2xl">{item.question}</span>}
        meta={
          <>
            <Badge tone="outline">{item.marks_allotted} marks</Badge>
            {item.word_limit && <Badge tone="outline">{item.word_limit} words</Badge>}
            {item.node_title && <Badge>{item.node_title}</Badge>}
          </>
        }
        actions={
          item.review_due &&
          !item.reviewed && (
            <LinkButton
              to={`/practice/answers/new?redo=${item._id}`}
              variant="primary"
              icon={<RotateCcw size={15} strokeWidth={2} />}
            >
              Rewrite it
            </LinkButton>
          )
        }
      />

      {item.review_due && (
        <Callout
          tone={item.reviewed ? 'success' : 'accent'}
          icon={item.reviewed ? CheckCheck : RotateCcw}
          className="mb-4 lg:mb-5"
          action={
            !item.reviewed && (
              <Button
                size="sm"
                onClick={() =>
                  update.mutate(
                    { reviewed: true },
                    { onSuccess: () => toast('Cleared from the redo queue.') },
                  )
                }
              >
                Clear it
              </Button>
            )
          }
        >
          {item.reviewed
            ? 'Rewritten and cleared.'
            : `Scored under half — back in the redo queue on ${formatDayIST(item.review_due)}.`}
        </Callout>
      )}

      <div className="mb-4 grid grid-cols-3 gap-3 lg:mb-5 lg:gap-5">
        <StatTile
          label="Self-score"
          value={item.self_score === null ? '—' : item.self_score}
          unit={item.self_score === null ? undefined : `/ ${item.marks_allotted}`}
          sub={ratio === null ? 'Not marked yet' : percent(ratio)}
          tone={ratio !== null && ratio < 0.5 ? 'danger' : 'default'}
        />
        <StatTile
          label="Time"
          value={item.minutes_taken ?? '—'}
          unit={item.minutes_taken === null ? undefined : 'min'}
        />
        <StatTile
          label="Words"
          value={item.words_written ?? '—'}
          sub={item.word_limit ? `limit ${item.word_limit}` : undefined}
        />
      </div>

      <div className="grid grid-cols-12 items-start gap-4 lg:gap-5">
        <div className="col-span-12 space-y-4 lg:col-span-8 lg:space-y-5">
          {item.text && (
            <Card>
              <CardHeader title="What she wrote" />
              <CardBody>
                <p className="max-w-prose whitespace-pre-wrap text-[15px] leading-7 text-ink">
                  {item.text}
                </p>
              </CardBody>
            </Card>
          )}

          {item.improvements && (
            <Card>
              <CardHeader
                title="To fix next time"
                icon={<Sparkles size={17} strokeWidth={1.8} />}
              />
              <CardBody>
                <p className="max-w-prose whitespace-pre-wrap text-[15px] leading-7 text-ink">
                  {item.improvements}
                </p>
              </CardBody>
            </Card>
          )}
        </div>

        <div className="col-span-12 space-y-4 lg:col-span-4 lg:space-y-5">
          <Card>
            <CardHeader title={item.self_score === null ? 'Score it' : 'Change the score'} />
            <CardBody className="space-y-3">
              {scoring ? (
                <>
                  <Field label="Self-score" hint={`out of ${item.marks_allotted}`} error={error}>
                    <NumberInput decimals value={score} onChange={setScore} placeholder="7.5" />
                  </Field>
                  <div className="flex gap-2">
                    <Button variant="primary" loading={update.isPending} onClick={saveScore}>
                      Save the score
                    </Button>
                    <Button variant="ghost" onClick={() => setScoring(false)}>
                      Cancel
                    </Button>
                  </div>
                </>
              ) : (
                <Button
                  full
                  onClick={() => {
                    setScore(item.self_score === null ? '' : String(item.self_score))
                    setScoring(true)
                  }}
                >
                  {item.self_score === null ? 'Score it' : 'Change the score'}
                </Button>
              )}
            </CardBody>
          </Card>

          {item.image_urls.length > 0 && (
            <Card>
              <CardHeader title="The sheet" icon={<Image size={17} strokeWidth={1.8} />} />
              <ul className="divide-y divide-hairline">
                {item.image_urls.map((url, index) => (
                  <li key={url}>
                    <a
                      href={url}
                      target="_blank"
                      rel="noreferrer"
                      className="flex min-h-tap items-center justify-between gap-2 px-4 py-2.5 text-sm text-accent transition-colors hover:bg-canvas sm:px-5"
                    >
                      Photograph {index + 1}
                      <ExternalLink size={14} strokeWidth={1.9} />
                    </a>
                  </li>
                ))}
              </ul>
            </Card>
          )}

          <Button
            variant="danger"
            full
            icon={<Trash2 size={15} strokeWidth={1.9} />}
            loading={remove.isPending}
            onClick={() => {
              if (!window.confirm('Delete this answer?')) return
              remove.mutate(item._id, {
                onSuccess: () => {
                  toast('Answer deleted.')
                  navigate('/practice')
                },
                onError: (caught) => toast(readable(caught), 'error'),
              })
            }}
          >
            Delete answer
          </Button>
        </div>
      </div>
    </>
  )
}

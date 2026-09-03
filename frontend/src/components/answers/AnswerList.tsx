import { PenLine, RotateCcw } from 'lucide-react'
import { Link } from 'react-router-dom'

import { scoreRatio, type Answer, type AnswerTrends } from '@/api/answers'
import { Sparkline, percent } from '@/components/charts/Sparkline'
import {
  Badge,
  Button,
  Card,
  CardFooter,
  CardHeader,
  EmptyState,
  QueryBoundary,
  SkeletonRows,
  StatTile,
} from '@/components/ui'
import { useAnswers, useRedoQueue } from '@/hooks/useAnswers'
import { formatDayIST } from '@/lib/date'

/**
 * Practice → Answers. The redo queue sits above the list rather than inside it:
 * an answer she rated under half thirty days ago is the one piece of work this
 * screen is actually asking for today.
 */
export function AnswerList() {
  const answers = useAnswers()
  const redo = useRedoQueue()

  const pages = answers.data?.pages ?? []
  const items = pages.flatMap((page) => page.items)
  const trends = pages[0]?.trends
  const queue = redo.data ?? []

  return (
    <>
      <Trends trends={trends} loading={!answers.data} redo={queue.length} />

      <div className="grid grid-cols-12 gap-4 lg:gap-5">
        <Card className="col-span-12 lg:col-span-8">
          <CardHeader
            title="Answers"
            count={items.length}
            icon={<PenLine size={17} strokeWidth={1.8} />}
          />
          <QueryBoundary
            query={answers}
            error="Could not load your answers."
            skeleton={<SkeletonRows rows={5} />}
            isEmpty={() => items.length === 0}
            empty={
              <EmptyState
                icon={PenLine}
                title="No answers yet."
                description="Start one on the clock — the minutes matter as much as the score."
              />
            }
          >
            {() => (
              <ul className="divide-y divide-hairline">
                {items.map((answer) => (
                  <AnswerRow key={answer._id} answer={answer} />
                ))}
              </ul>
            )}
          </QueryBoundary>

          {answers.hasNextPage && (
            <CardFooter className="p-0">
              <Button
                variant="ghost"
                full
                className="rounded-none"
                loading={answers.isFetchingNextPage}
                onClick={() => void answers.fetchNextPage()}
              >
                Show older answers
              </Button>
            </CardFooter>
          )}
        </Card>

        <Card className="col-span-12 self-start lg:col-span-4">
          <CardHeader
            title="Redo queue"
            count={queue.length}
            subtitle="Rated under half, thirty days ago."
            icon={<RotateCcw size={17} strokeWidth={1.8} />}
          />
          {queue.length === 0 ? (
            <EmptyState
              size="sm"
              title="Nothing waiting."
              description="Answers you rated under half come back here after a month."
            />
          ) : (
            <ul className="divide-y divide-hairline">
              {queue.map((answer) => (
                <li key={answer._id}>
                  <Link
                    to={`/practice/answers/new?redo=${answer._id}`}
                    className="block px-4 py-3 transition-colors hover:bg-canvas sm:px-5"
                  >
                    <p className="line-clamp-2 text-sm text-ink">{answer.question}</p>
                    <p className="mt-1 flex items-center gap-2 text-xs text-muted">
                      <Badge tone="accent" size="sm">
                        {percent(scoreRatio(answer))}
                      </Badge>
                      {answer.node_title ?? answer.paper} · {formatDayIST(answer.date)}
                    </p>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </>
  )
}

/**
 * The two header trends over the last twenty. Only the score gets a line:
 * minutes across a 10-marker and a 125-mark essay share no band, and a line
 * drawn across both would say something untrue.
 */
function Trends({
  trends,
  loading,
  redo,
}: {
  trends?: AnswerTrends
  loading: boolean
  redo: number
}) {
  return (
    <div className="mb-4 grid grid-cols-2 gap-3 lg:mb-5 lg:grid-cols-4 lg:gap-5">
      <StatTile label="Written" value={trends?.count ?? 0} loading={loading} sub="last twenty shown" />
      <StatTile
        label="Average time"
        value={trends?.average_minutes ?? '—'}
        unit={trends?.average_minutes ? 'min' : undefined}
        loading={loading}
      />
      <StatTile
        label="Average score"
        value={percent(trends?.average_score ?? null)}
        loading={loading}
        sub={
          trends && trends.scores.length > 1 ? (
            <span className="block text-accent">
              <Sparkline values={trends.scores} what="Self-score" width={140} height={30} />
            </span>
          ) : undefined
        }
      />
      <StatTile
        label="Up for a rewrite"
        value={redo}
        tone={redo > 0 ? 'accent' : 'default'}
        loading={loading}
        sub={redo > 0 ? 'in the redo queue' : 'nothing waiting'}
      />
    </div>
  )
}

function AnswerRow({ answer }: { answer: Answer }) {
  const ratio = scoreRatio(answer)

  return (
    <li>
      <Link
        to={`/practice/answers/${answer._id}`}
        className="flex min-h-tap items-center gap-3 px-4 py-2.5 transition-colors hover:bg-canvas sm:px-5"
      >
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm text-ink">{answer.question}</span>
          <span className="block truncate text-xs text-muted">
            {formatDayIST(answer.date)} · {answer.paper} · {answer.marks_allotted} marks
            {answer.minutes_taken !== null && ` · ${answer.minutes_taken} min`}
          </span>
        </span>
        <span className="shrink-0 text-right">
          <span className="block text-sm tabular-nums text-ink">
            {answer.self_score === null ? '—' : answer.self_score}
            <span className="text-faint">/{answer.marks_allotted}</span>
          </span>
          <span className="block text-xs tabular-nums text-muted">{percent(ratio)}</span>
        </span>
      </Link>
    </li>
  )
}

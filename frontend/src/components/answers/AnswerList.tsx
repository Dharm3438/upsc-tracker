import { Link } from 'react-router-dom'

import { scoreRatio, type Answer, type AnswerTrends } from '@/api/answers'
import { EmptyState } from '@/components/EmptyState'
import { Sparkline, percent } from '@/components/charts/Sparkline'
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

  return (
    <>
      {trends && trends.count > 0 && <Trends trends={trends} />}

      {redo.data && redo.data.length > 0 && (
        <section className="pb-2">
          <div className="flex items-baseline justify-between px-4 pb-2">
            <h2 className="text-xs uppercase tracking-wide text-slate">Redo queue</h2>
            <span className="text-sm tabular-nums text-slate">{redo.data.length}</span>
          </div>
          <div className="border-y border-line bg-surface">
            {redo.data.map((answer) => (
              <Link
                key={answer._id}
                to={`/practice/answers/new?redo=${answer._id}`}
                className="flex min-h-tap items-center gap-3 border-b border-line px-4 py-2.5 last:border-0"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm">{answer.question}</p>
                  <p className="truncate text-xs text-slate">
                    {answer.node_title ?? answer.paper} · scored{' '}
                    {percent(scoreRatio(answer))} on {formatDayIST(answer.date)}
                  </p>
                </div>
                <span className="shrink-0 text-sm text-signal">Rewrite</span>
              </Link>
            ))}
          </div>
        </section>
      )}

      <div className="border-y border-line bg-surface">
        {answers.isError && <EmptyState>Could not load your answers.</EmptyState>}
        {!answers.data && !answers.isError && <EmptyState>Loading…</EmptyState>}
        {items.length === 0 && answers.data && (
          <EmptyState>
            No answers yet. Start one on the clock — the minutes matter as much
            as the score.
          </EmptyState>
        )}
        {items.map((answer) => (
          <AnswerRow key={answer._id} answer={answer} />
        ))}
      </div>

      {answers.hasNextPage && (
        <button
          type="button"
          onClick={() => void answers.fetchNextPage()}
          disabled={answers.isFetchingNextPage}
          className="h-tap w-full text-sm text-signal"
        >
          {answers.isFetchingNextPage ? 'Loading…' : 'Show older answers'}
        </button>
      )}

      <div className="p-4">
        <Link
          to="/practice/answers/new"
          className="flex h-tap w-full items-center justify-center rounded bg-signal text-sm font-medium text-surface"
        >
          Start an answer
        </Link>
      </div>
    </>
  )
}

/** The two header trends of plan §8.5, over the last twenty.
 *
 *  Only the score gets a line. Minutes across a 10-marker and a 125-mark essay
 *  share no band, and a line drawn across both would say something untrue. */
function Trends({ trends }: { trends: AnswerTrends }) {
  return (
    <div className="flex items-center justify-between px-4 pb-3 text-slate">
      <div>
        <p className="text-xs">Last {trends.count}</p>
        <p className="text-sm text-ink">
          {trends.average_minutes === null ? '—' : `${trends.average_minutes} min`}
          <span className="text-slate"> · </span>
          {percent(trends.average_score)}
        </p>
      </div>
      <span className="text-signal">
        <Sparkline values={trends.scores} what="Self-score" />
      </span>
    </div>
  )
}

function AnswerRow({ answer }: { answer: Answer }) {
  const ratio = scoreRatio(answer)

  return (
    <Link
      to={`/practice/answers/${answer._id}`}
      className="flex min-h-tap items-center gap-3 border-b border-line px-4 py-2.5 last:border-0"
    >
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm">{answer.question}</p>
        <p className="truncate text-xs text-slate">
          {formatDayIST(answer.date)} · {answer.paper} · {answer.marks_allotted} marks
          {answer.minutes_taken !== null && ` · ${answer.minutes_taken} min`}
        </p>
      </div>
      <div className="shrink-0 text-right">
        <p className="text-sm tabular-nums">
          {answer.self_score === null ? '—' : answer.self_score}
          <span className="text-slate">/{answer.marks_allotted}</span>
        </p>
        <p className="text-xs tabular-nums text-slate">{percent(ratio)}</p>
      </div>
    </Link>
  )
}

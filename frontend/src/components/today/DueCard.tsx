import { useState } from 'react'
import { ChevronRight, RotateCcw } from 'lucide-react'

import type { DueNode } from '@/api/review'
import { GradeSheet } from '@/components/review/GradeSheet'
import { toast } from '@/components/shell/Toast'
import {
  Button,
  Card,
  CardFooter,
  CardHeader,
  ConfidenceScale,
  EmptyState,
  QueryBoundary,
  SkeletonRows,
} from '@/components/ui'
import { useCreateLog } from '@/hooks/useLogs'
import { useDue } from '@/hooks/useReview'
import { cn } from '@/lib/cn'
import { formatDayIST } from '@/lib/date'
import { readable } from '@/lib/errors'
import { ATTENTION_DAYS } from '@/lib/tokens'

/** Enough to start on without the card filling the screen; the rest is one
 *  click away. Wider on desktop, where the card is taller. */
const INITIAL_ROWS = 6

/**
 * The half of the dashboard that matters most. On a wide screen the 1-5 scale
 * sits on the row itself, so a six-topic morning is six clicks with no dialog
 * in between; on a phone the row opens the grading sheet as before.
 */
export function DueCard() {
  const due = useDue()
  const [expanded, setExpanded] = useState(false)
  const [grading, setGrading] = useState<DueNode | null>(null)

  const items = due.data?.items ?? []
  const shown = expanded ? items : items.slice(0, INITIAL_ROWS)
  const hidden = items.length - shown.length

  return (
    <>
      <Card className="col-span-12 lg:col-span-7">
        <CardHeader
          title="Due for revision"
          // The heading counts everything due, not just the rows on screen.
          count={due.data?.total}
          subtitle="Weakest first. Grading one schedules the next visit."
          icon={<RotateCcw size={17} strokeWidth={1.8} />}
        />
        <QueryBoundary
          query={due}
          error="Could not load what is due."
          skeleton={<SkeletonRows rows={4} />}
          isEmpty={(data) => data.items.length === 0}
          empty={
            <EmptyState
              title="Nothing to revise today."
              description="Good day to start something new."
            />
          }
        >
          {() => (
            <ul className="divide-y divide-hairline">
              {shown.map((node) => (
                <DueRow key={node.node_id} node={node} onOpen={() => setGrading(node)} />
              ))}
            </ul>
          )}
        </QueryBoundary>

        {hidden > 0 && (
          <CardFooter className="p-0">
            <Button variant="ghost" full onClick={() => setExpanded(true)} className="rounded-none">
              Show {hidden} more
            </Button>
          </CardFooter>
        )}
      </Card>

      {grading && <GradeSheet node={grading} onClose={() => setGrading(null)} />}
    </>
  )
}

function DueRow({ node, onOpen }: { node: DueNode; onOpen: () => void }) {
  const create = useCreateLog()
  const late = node.days_overdue > ATTENTION_DAYS

  function grade(confidence: number) {
    create.mutate(
      {
        node_id: node.node_id,
        // Grading from the due list *is* recall: she is answering from memory
        // with the topic title as the only prompt.
        type: 'revise',
        payload: { confidence, method: 'recall' },
      },
      {
        onSuccess: (result) =>
          toast(result.next_due ? `Back on ${formatDayIST(result.next_due)}.` : 'Saved.'),
        onError: (caught) => toast(readable(caught), 'error'),
      },
    )
  }

  const crumbs = node.path.split('/')

  return (
    <li className="px-4 py-2.5 sm:px-5">
      <div className="flex items-center gap-3 lg:gap-5">
        <button
          type="button"
          onClick={onOpen}
          className="flex min-w-0 flex-1 items-center gap-3 text-left lg:cursor-default"
        >
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-medium text-ink">{node.title}</span>
            <span className="block truncate text-xs text-muted">
              {crumbs[0]} · {crumbs.slice(1, -1).join(' › ')}
            </span>
          </span>
          <span
            className={cn(
              'shrink-0 text-xs tabular-nums',
              late ? 'font-medium text-danger' : 'text-muted',
            )}
          >
            {state(node)}
          </span>
          <ChevronRight size={16} className="shrink-0 text-hairline lg:hidden" aria-hidden />
        </button>

        {/* Grading in place. Below `lg` the row opens the sheet instead — five
            44px targets do not fit across a phone. */}
        <div className="hidden w-[220px] shrink-0 lg:block">
          <ConfidenceScale
            value={null}
            disabled={create.isPending}
            onChange={grade}
            size="md"
          />
        </div>
      </div>
    </li>
  )
}

/** How late it is if it is late, otherwise how it went last time. Lateness is
 *  the more urgent of the two, so it wins the space. */
function state(node: DueNode): string {
  if (node.days_overdue > 0) return `${node.days_overdue}d late`
  if (node.last_confidence) return `last ${node.last_confidence}/5`
  return 'new'
}

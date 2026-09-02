import { useState } from 'react'
import { Check, ChevronDown } from 'lucide-react'

import { TAGS, type Mistake, type MistakeTag } from '@/api/mistakes'
import { Badge, Button, Chip, EmptyState, QueryBoundary, SkeletonRows } from '@/components/ui'
import { cn } from '@/lib/cn'
import { toast } from '@/components/shell/Toast'
import { useDeleteMistake, useMistakes, useUpdateMistake } from '@/hooks/useMistakes'
import { formatDayIST } from '@/lib/date'
import { readable } from '@/lib/errors'

/** The short form is what fits at the end of a row. */
function tagShort(tag: MistakeTag): string {
  return TAGS.find((option) => option.value === tag)?.short ?? tag
}

/**
 * The rows are the notebook. A tap opens the one row's actions rather than a
 * screen: retagging is the common edit, and it should not cost a navigation.
 */
export function MistakeList({
  query,
  empty,
  showTopic = true,
}: {
  query: ReturnType<typeof useMistakes>
  empty: string
  showTopic?: boolean
}) {
  const [open, setOpen] = useState<string | null>(null)
  const items = query.data?.pages.flatMap((page) => page.items) ?? []

  return (
    <>
      <QueryBoundary
        query={query}
        error="Could not load the notebook."
        skeleton={<SkeletonRows rows={5} />}
        isEmpty={() => items.length === 0}
        empty={<EmptyState title="Nothing here yet." description={empty} />}
      >
        {() => (
          <ul className="divide-y divide-hairline">
            {items.map((mistake) => (
              <li key={mistake._id}>
                <Row
                  mistake={mistake}
                  showTopic={showTopic}
                  open={open === mistake._id}
                  onToggle={() => setOpen(open === mistake._id ? null : mistake._id)}
                />
              </li>
            ))}
          </ul>
        )}
      </QueryBoundary>

      {query.hasNextPage && (
        <Button
          variant="ghost"
          full
          className="rounded-none border-t border-hairline"
          loading={query.isFetchingNextPage}
          onClick={() => void query.fetchNextPage()}
        >
          Show more
        </Button>
      )}
    </>
  )
}

function Row({
  mistake,
  showTopic,
  open,
  onToggle,
}: {
  mistake: Mistake
  showTopic: boolean
  open: boolean
  onToggle: () => void
}) {
  const update = useUpdateMistake()
  const remove = useDeleteMistake()

  return (
    <>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="flex w-full min-h-tap items-start gap-3 px-4 py-2.5 text-left transition-colors hover:bg-canvas sm:px-5"
      >
        <div className="min-w-0 flex-1">
          <p
            className={[
              'truncate text-sm text-ink',
              // Nothing typed is normal on a fast entry run; the row still has
              // its topic and its tag, which is the part that matters.
              mistake.question || mistake.note ? '' : 'text-muted',
              // A settled mistake stays in the list — the pattern it belongs to
              // is still real — but it stops competing for attention.
              mistake.resolved ? 'text-muted line-through' : '',
            ].join(' ')}
          >
            {mistake.question || mistake.note || 'No question recorded'}
          </p>
          <p className="truncate text-xs text-muted">
            {showTopic && mistake.node_title ? `${mistake.node_title} · ` : ''}
            {mistake.paper} · {formatDayIST(mistake.date)}
          </p>
        </div>
        <span className="flex shrink-0 items-center gap-2 pt-0.5">
          {mistake.resolved && (
            <Check size={14} strokeWidth={2.2} className="text-success" aria-label="Settled" />
          )}
          <Badge tone={mistake.resolved ? 'success' : 'neutral'} size="sm">
            {tagShort(mistake.tag)}
          </Badge>
          <ChevronDown
            size={14}
            strokeWidth={2}
            aria-hidden
            className={cn('text-faint transition-transform', open && 'rotate-180')}
          />
        </span>
      </button>

      {open && (
        <div className="space-y-3 bg-canvas px-4 py-3.5 sm:px-5">
          {mistake.note && <p className="text-sm text-ink">{mistake.note}</p>}
          {mistake.source_title && (
            <p className="text-xs text-muted">From {mistake.source_title}</p>
          )}

          <div className="flex flex-wrap gap-2">
            {TAGS.map((option) => (
              <Chip
                key={option.value}
                selected={mistake.tag === option.value}
                onClick={() => update.mutate({ id: mistake._id, tag: option.value })}
              >
                {option.short}
              </Chip>
            ))}
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              onClick={() =>
                update.mutate(
                  { id: mistake._id, resolved: !mistake.resolved },
                  {
                    onSuccess: () =>
                      toast(mistake.resolved ? 'Back on the list.' : 'Marked settled.'),
                    onError: (caught) => toast(readable(caught), 'error'),
                  },
                )
              }
            >
              {mistake.resolved ? 'Reopen' : 'Mark settled'}
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                if (!window.confirm('Delete this mistake?')) return
                remove.mutate(mistake._id, {
                  onSuccess: () => toast('Deleted.'),
                  onError: (caught) => toast(readable(caught), 'error'),
                })
              }}
            >
              Delete
            </Button>
          </div>
        </div>
      )}
    </>
  )
}

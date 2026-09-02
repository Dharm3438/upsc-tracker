import { useState } from 'react'

import { TAGS, type Mistake, type MistakeTag } from '@/api/mistakes'
import { EmptyState } from '@/components/EmptyState'
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

  if (query.isError) return <EmptyState>Could not load the notebook.</EmptyState>
  if (!query.data) return <EmptyState>Loading…</EmptyState>
  if (items.length === 0) return <EmptyState>{empty}</EmptyState>

  return (
    <>
      <ul>
        {items.map((mistake) => (
          <li key={mistake._id} className="border-b border-line last:border-0">
            <Row
              mistake={mistake}
              showTopic={showTopic}
              open={open === mistake._id}
              onToggle={() => setOpen(open === mistake._id ? null : mistake._id)}
            />
          </li>
        ))}
      </ul>

      {query.hasNextPage && (
        <button
          type="button"
          onClick={() => void query.fetchNextPage()}
          disabled={query.isFetchingNextPage}
          className="h-tap w-full text-sm text-signal"
        >
          {query.isFetchingNextPage ? 'Loading…' : 'Show more'}
        </button>
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
        className="flex w-full min-h-tap items-start gap-3 px-4 py-2.5 text-left"
      >
        <div className="min-w-0 flex-1">
          <p
            className={[
              'truncate text-sm',
              // Nothing typed is normal on a fast entry run; the row still has
              // its topic and its tag, which is the part that matters.
              mistake.question || mistake.note ? '' : 'text-slate',
              // A settled mistake stays in the list — the pattern it belongs to
              // is still real — but it stops competing for attention.
              mistake.resolved ? 'text-slate line-through' : '',
            ].join(' ')}
          >
            {mistake.question || mistake.note || 'No question recorded'}
          </p>
          <p className="truncate text-xs text-slate">
            {showTopic && mistake.node_title ? `${mistake.node_title} · ` : ''}
            {mistake.paper} · {formatDayIST(mistake.date)}
          </p>
        </div>
        <span className="shrink-0 pt-0.5 text-xs text-slate">
          {tagShort(mistake.tag)}
        </span>
      </button>

      {open && (
        <div className="space-y-3 bg-paper px-4 py-3">
          {mistake.note && <p className="text-sm">{mistake.note}</p>}
          {mistake.source_title && (
            <p className="text-xs text-slate">From {mistake.source_title}</p>
          )}

          <div className="flex flex-wrap gap-2">
            {TAGS.map((option) => (
              <button
                key={option.value}
                type="button"
                aria-pressed={mistake.tag === option.value}
                onClick={() =>
                  update.mutate({ id: mistake._id, tag: option.value })
                }
                className={[
                  'h-9 rounded-full border px-3 text-xs',
                  mistake.tag === option.value
                    ? 'border-signal bg-signal text-surface'
                    : 'border-line bg-surface text-slate',
                ].join(' ')}
              >
                {option.short}
              </button>
            ))}
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() =>
                update.mutate(
                  { id: mistake._id, resolved: !mistake.resolved },
                  {
                    onSuccess: () =>
                      toast(mistake.resolved ? 'Back on the list.' : 'Marked settled.'),
                    onError: (caught) => toast(readable(caught)),
                  },
                )
              }
              className="h-tap flex-1 rounded border border-line bg-surface text-sm"
            >
              {mistake.resolved ? 'Reopen' : 'Mark settled'}
            </button>
            <button
              type="button"
              onClick={() => {
                if (!window.confirm('Delete this mistake?')) return
                remove.mutate(mistake._id, {
                  onSuccess: () => toast('Deleted.'),
                  onError: (caught) => toast(readable(caught)),
                })
              }}
              className="h-tap w-24 rounded border border-line bg-surface text-sm text-slate"
            >
              Delete
            </button>
          </div>
        </div>
      )}
    </>
  )
}

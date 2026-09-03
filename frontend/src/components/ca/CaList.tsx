import { useState } from 'react'
import { ChevronDown, Star } from 'lucide-react'

import type { CaItem } from '@/api/ca'
import { Badge, Button, EmptyState, QueryBoundary, SkeletonRows } from '@/components/ui'
import { NodePicker, type PickedNode } from '@/components/log/NodePicker'
import { cn } from '@/lib/cn'
import { toast } from '@/components/shell/Toast'
import { useDeleteCaItem, useUpdateCaItem } from '@/hooks/useCa'
import type { useCaItems } from '@/hooks/useCa'
import { formatDayIST } from '@/lib/date'
import { readable } from '@/lib/errors'

/** Items grouped under the day they happened — the reverse-chronological list
 *  of plan §8.6. Groups come out of the order the server sent, which is already
 *  newest first, so no sorting happens here. */
export function CaList({
  query,
  empty,
  onEdit,
}: {
  query: ReturnType<typeof useCaItems>
  empty: string
  onEdit: (item: CaItem) => void
}) {
  const items = query.data?.pages.flatMap((page) => page.items) ?? []

  const groups: { date: string; items: CaItem[] }[] = []
  for (const item of items) {
    const last = groups.at(-1)
    if (last?.date === item.date) last.items.push(item)
    else groups.push({ date: item.date, items: [item] })
  }

  return (
    <>
      <QueryBoundary
        query={query}
        error="Could not load current affairs."
        skeleton={<SkeletonRows rows={5} />}
        isEmpty={() => items.length === 0}
        empty={<EmptyState title="Nothing here yet." description={empty} />}
      >
        {() => (
          <>
            {groups.map((group) => (
              <section key={group.date}>
                <h3 className="sticky top-0 z-[1] border-y border-hairline bg-canvas/95 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.08em] text-faint backdrop-blur sm:px-5">
                  {formatDayIST(group.date)}
                </h3>
                <CaRows items={group.items} onEdit={onEdit} />
              </section>
            ))}
          </>
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

/** A flat run of rows. The inbox uses this directly: it is a queue, and
 *  splitting it by date would only make it look longer than it is. */
export function CaRows({
  items,
  onEdit,
}: {
  items: CaItem[]
  onEdit: (item: CaItem) => void
}) {
  const [open, setOpen] = useState<string | null>(null)

  return (
    <ul className="divide-y divide-hairline">
      {items.map((item) => (
        <li key={item._id}>
          <Row
            item={item}
            open={open === item._id}
            onToggle={() => setOpen(open === item._id ? null : item._id)}
            onEdit={() => onEdit(item)}
          />
        </li>
      ))}
    </ul>
  )
}

function Row({
  item,
  open,
  onToggle,
  onEdit,
}: {
  item: CaItem
  open: boolean
  onToggle: () => void
  onEdit: () => void
}) {
  const update = useUpdateCaItem()
  const remove = useDeleteCaItem()

  function tag(node: PickedNode) {
    update.mutate(
      { id: item._id, node_id: node.id },
      {
        onSuccess: () => toast(`Tagged to ${node.title}.`),
        onError: (caught) => toast(readable(caught)),
      },
    )
  }

  return (
    <>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="flex w-full min-h-tap items-start gap-3 px-4 py-2.5 text-left transition-colors hover:bg-canvas sm:px-5"
      >
        <div className="min-w-0 flex-1">
          <p className="text-sm text-ink">{item.headline}</p>
          <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted">
            {item.tagged ? (
              <Badge tone="neutral" size="sm">
                {item.node_title}
              </Badge>
            ) : (
              <Badge tone="accent" size="sm">
                Not tagged yet
              </Badge>
            )}
            {item.source && <span className="truncate">{item.source}</span>}
          </p>
        </div>
        <span className="flex shrink-0 items-center gap-2 pt-0.5">
          {item.starred && (
            <Star
              size={14}
              strokeWidth={2}
              className="fill-accent text-accent"
              aria-label="Starred"
            />
          )}
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
          {item.note ? (
            <p className="text-sm text-ink">{item.note}</p>
          ) : (
            <p className="text-sm text-muted">No note. Add one while it is fresh.</p>
          )}

          <div>
            <p className="pb-1.5 text-xs font-medium text-muted">
              {item.tagged ? 'Move it to another topic' : 'Tag it to a topic'}
            </p>
            <NodePicker
              value={
                item.node_id && item.node_title
                  ? {
                      id: item.node_id,
                      title: item.node_title,
                      path: item.node_path ?? item.node_title,
                    }
                  : null
              }
              onChange={tag}
            />
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              icon={
                <Star
                  size={14}
                  strokeWidth={2}
                  className={item.starred ? 'fill-accent text-accent' : undefined}
                />
              }
              onClick={() =>
                update.mutate(
                  { id: item._id, starred: !item.starred },
                  { onError: (caught) => toast(readable(caught), 'error') },
                )
              }
            >
              {item.starred ? 'Unstar' : 'Star'}
            </Button>
            <Button onClick={onEdit}>Edit</Button>
            <Button
              variant="danger"
              onClick={() => {
                if (!window.confirm('Delete this item?')) return
                remove.mutate(item._id, {
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

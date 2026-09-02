import { useState } from 'react'

import type { CaItem } from '@/api/ca'
import { EmptyState } from '@/components/EmptyState'
import { NodePicker, type PickedNode } from '@/components/log/NodePicker'
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

  if (query.isError) return <EmptyState>Could not load current affairs.</EmptyState>
  if (!query.data) return <EmptyState>Loading…</EmptyState>
  if (items.length === 0) return <EmptyState>{empty}</EmptyState>

  const groups: { date: string; items: CaItem[] }[] = []
  for (const item of items) {
    const last = groups.at(-1)
    if (last?.date === item.date) last.items.push(item)
    else groups.push({ date: item.date, items: [item] })
  }

  return (
    <>
      {groups.map((group) => (
        <section key={group.date}>
          <h3 className="border-b border-line bg-paper px-4 py-1.5 text-xs text-slate">
            {formatDayIST(group.date)}
          </h3>
          <CaRows items={group.items} onEdit={onEdit} />
        </section>
      ))}

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
    <ul>
      {items.map((item) => (
        <li key={item._id} className="border-b border-line last:border-0">
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
        className="flex w-full min-h-tap items-start gap-3 px-4 py-2.5 text-left"
      >
        <div className="min-w-0 flex-1">
          <p className="text-sm">{item.headline}</p>
          <p className="truncate text-xs text-slate">
            {item.node_title ?? 'Not tagged yet'}
            {item.source ? ` · ${item.source}` : ''}
          </p>
        </div>
        {item.starred && (
          <span className="shrink-0 pt-0.5 text-xs text-signal" aria-label="Starred">
            ★
          </span>
        )}
      </button>

      {open && (
        <div className="space-y-3 bg-paper px-4 py-3">
          {item.note ? (
            <p className="text-sm">{item.note}</p>
          ) : (
            <p className="text-sm text-slate">No note. Add one while it is fresh.</p>
          )}

          <div>
            <p className="pb-1.5 text-xs text-slate">
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

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() =>
                update.mutate(
                  { id: item._id, starred: !item.starred },
                  { onError: (caught) => toast(readable(caught)) },
                )
              }
              className="h-tap flex-1 rounded border border-line bg-surface text-sm"
            >
              {item.starred ? 'Unstar' : 'Star'}
            </button>
            <button
              type="button"
              onClick={onEdit}
              className="h-tap flex-1 rounded border border-line bg-surface text-sm"
            >
              Edit
            </button>
            <button
              type="button"
              onClick={() => {
                if (!window.confirm('Delete this item?')) return
                remove.mutate(item._id, {
                  onSuccess: () => toast('Deleted.'),
                  onError: (caught) => toast(readable(caught)),
                })
              }}
              className="h-tap w-20 rounded border border-line bg-surface text-sm text-slate"
            >
              Delete
            </button>
          </div>
        </div>
      )}
    </>
  )
}

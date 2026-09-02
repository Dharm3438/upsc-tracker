import { useState } from 'react'

import type { CaItem, NewCaItem } from '@/api/ca'
import { NodePicker, type PickedNode } from '@/components/log/NodePicker'
import { Sheet } from '@/components/shell/Sheet'
import { toast } from '@/components/shell/Toast'
import { useCreateCaItem, useUpdateCaItem } from '@/hooks/useCa'
import { todayIST } from '@/lib/date'
import { readable } from '@/lib/errors'

/**
 * Capture is two fields: what happened, and what she makes of it. The source,
 * the date and the topic are all below them and all optional — an item she
 * cannot place yet is supposed to go in untagged and wait in the inbox, which
 * is the whole reason the inbox exists.
 */
export function CaSheet({
  existing,
  onClose,
}: {
  existing?: CaItem
  onClose: () => void
}) {
  const [headline, setHeadline] = useState(existing?.headline ?? '')
  const [note, setNote] = useState(existing?.note ?? '')
  const [source, setSource] = useState(existing?.source ?? '')
  const [date, setDate] = useState(existing?.date ?? todayIST())
  const [node, setNode] = useState<PickedNode | null>(
    existing?.node_id && existing.node_title
      ? {
          id: existing.node_id,
          title: existing.node_title,
          path: existing.node_path ?? existing.node_title,
        }
      : null,
  )
  const [topicOpen, setTopicOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const create = useCreateCaItem()
  const update = useUpdateCaItem()
  const saving = create.isPending || update.isPending

  function save() {
    if (!headline.trim()) return setError('What happened? A few words is enough.')
    setError(null)

    const body: NewCaItem = {
      headline: headline.trim(),
      note: note.trim(),
      source: source.trim(),
      date,
      node_id: node?.id ?? null,
    }

    const done = {
      onSuccess: () => {
        toast(
          existing ? 'Item updated.' : node ? 'Saved and tagged.' : 'Saved to the inbox.',
        )
        onClose()
      },
      onError: (caught: unknown) => setError(readable(caught)),
    }

    if (existing) update.mutate({ id: existing._id, ...body }, done)
    else create.mutate(body, done)
  }

  return (
    <Sheet title={existing ? 'Edit item' : 'Add a current affair'} onClose={onClose}>
      <div className="max-h-[75vh] space-y-4 overflow-y-auto p-4">
        <Field label="What happened">
          <input
            value={headline}
            onChange={(event) => setHeadline(event.target.value)}
            placeholder="Sixteenth Finance Commission constituted"
            className="h-tap w-full rounded border border-line px-3 text-sm focus:border-signal"
          />
        </Field>

        <Field label="In your words">
          <textarea
            value={note}
            onChange={(event) => setNote(event.target.value)}
            rows={3}
            placeholder="Why it matters, in a line or two."
            className="w-full rounded border border-line p-3 text-sm focus:border-signal"
          />
        </Field>

        <div className="flex gap-3">
          <Field label="Source" className="flex-1">
            <input
              value={source}
              onChange={(event) => setSource(event.target.value)}
              placeholder="The Hindu"
              className="h-tap w-full rounded border border-line px-3 text-sm focus:border-signal"
            />
          </Field>
          <Field label="Date" className="w-40">
            <input
              type="date"
              value={date}
              onChange={(event) => setDate(event.target.value)}
              className="h-tap w-full rounded border border-line px-3 text-sm focus:border-signal"
            />
          </Field>
        </div>

        <Field label="Topic (optional)">
          {topicOpen || node ? (
            <NodePicker value={node} onChange={setNode} />
          ) : (
            <button
              type="button"
              onClick={() => setTopicOpen(true)}
              className="h-tap w-full rounded border border-line text-sm text-slate"
            >
              Tag it now
            </button>
          )}
          {!node && (
            <p className="pt-1.5 text-xs text-slate">
              Leave it and the item waits in the inbox until you know where it goes.
            </p>
          )}
        </Field>

        {error && <p className="text-sm text-overdue">{error}</p>}

        <button
          type="button"
          onClick={save}
          disabled={saving}
          className="h-tap w-full rounded bg-signal text-sm font-medium text-surface disabled:opacity-60"
        >
          {saving ? 'Saving…' : existing ? 'Save changes' : 'Save item'}
        </button>
      </div>
    </Sheet>
  )
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

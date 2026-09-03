import { useState } from 'react'

import type { CaItem, NewCaItem } from '@/api/ca'
import { NodePicker, type PickedNode } from '@/components/log/NodePicker'
import { Sheet } from '@/components/shell/Sheet'
import { toast } from '@/components/shell/Toast'
import { Button, Callout, Field, Input, Textarea } from '@/components/ui'
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
    <Sheet
      title={existing ? 'Edit item' : 'Add a current affair'}
      description="Two lines a day is enough."
      onClose={onClose}
      footer={
        <Button variant="primary" size="lg" full loading={saving} onClick={save}>
          {existing ? 'Save changes' : 'Save item'}
        </Button>
      }
    >
      <div className="space-y-4 p-4 sm:p-5">
        <Field label="What happened">
          <Input
            value={headline}
            onChange={(event) => setHeadline(event.target.value)}
            placeholder="Sixteenth Finance Commission constituted"
          />
        </Field>

        <Field label="In your words">
          <Textarea
            value={note}
            onChange={(event) => setNote(event.target.value)}
            rows={3}
            placeholder="Why it matters, in a line or two."
          />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Source">
            <Input
              value={source}
              onChange={(event) => setSource(event.target.value)}
              placeholder="The Hindu"
            />
          </Field>
          <Field label="Date">
            <Input
              type="date"
              value={date}
              onChange={(event) => setDate(event.target.value)}
            />
          </Field>
        </div>

        <Field label="Topic" hint="optional">
          {topicOpen || node ? (
            <NodePicker value={node} onChange={setNode} />
          ) : (
            <Button full onClick={() => setTopicOpen(true)}>
              Tag it now
            </Button>
          )}
          {!node && (
            <p className="pt-1.5 text-xs text-muted">
              Leave it and the item waits in the inbox until you know where it goes.
            </p>
          )}
        </Field>

        {error && <Callout tone="danger">{error}</Callout>}
      </div>
    </Sheet>
  )
}

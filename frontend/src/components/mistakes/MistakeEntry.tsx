import { useState } from 'react'

import { TAGS, type MistakeItem, type MistakeTag } from '@/api/mistakes'
import { NodePicker, type PickedNode } from '@/components/log/NodePicker'
import { X } from 'lucide-react'

import { Sheet } from '@/components/shell/Sheet'
import { Badge, Button, Callout, Field, Input } from '@/components/ui'
import { cn } from '@/lib/cn'
import { toast } from '@/components/shell/Toast'
import { useAddTestMistakes } from '@/hooks/useMistakes'
import { readable } from '@/lib/errors'

type Pending = MistakeItem & { title: string }

/**
 * Rapid entry: 27 wrong answers have to go in while she still remembers why
 * each one was wrong, so rows queue up locally and save in one request.
 *
 * The topic stays selected after each row. Wrong answers cluster — four in a
 * row on Federalism is the normal shape of a bad section — so re-picking the
 * topic every time would be most of the typing.
 */
export function MistakeEntry({
  testId,
  wrong,
  alreadyLogged,
  onClose,
}: {
  testId: string
  wrong: number
  alreadyLogged: number
  onClose: () => void
}) {
  const [node, setNode] = useState<PickedNode | null>(null)
  const [tag, setTag] = useState<MistakeTag | null>(null)
  const [question, setQuestion] = useState('')
  const [note, setNote] = useState('')
  const [queue, setQueue] = useState<Pending[]>([])
  const [error, setError] = useState<string | null>(null)

  const add = useAddTestMistakes(testId)
  const remaining = wrong - alreadyLogged - queue.length

  function queueRow(): void {
    if (!node) {
      setError('Which topic was it on?')
      return
    }
    if (!tag) {
      setError('What kind of mistake was it?')
      return
    }
    setError(null)
    setQueue((current) => [
      ...current,
      {
        node_id: node.id,
        tag,
        question: question.trim(),
        note: note.trim(),
        title: node.title,
      },
    ])
    // The topic stays; everything specific to this question clears.
    setTag(null)
    setQuestion('')
    setNote('')
  }

  function save() {
    // The row still on screen is saved along with the queue: losing it because
    // she tapped Save rather than Add another would be maddening.
    const items: MistakeItem[] = [
      ...queue.map(({ title: _title, ...item }) => item),
      ...(node && tag
        ? [{ node_id: node.id, tag, question: question.trim(), note: note.trim() }]
        : []),
    ]

    if (items.length === 0) {
      setError('Pick a topic and a kind, then save.')
      return
    }

    add.mutate(items, {
      onSuccess: (saved) => {
        toast(`${saved.length} recorded.`)
        onClose()
      },
      onError: (caught) => setError(readable(caught)),
    })
  }

  return (
    <Sheet
      title="Add mistakes"
      description="The topic stays selected between rows, so a run of them is fast."
      onClose={onClose}
      footer={
        <div className="flex gap-2">
          <Button full onClick={queueRow}>
            Add another
          </Button>
          <Button variant="primary" full loading={add.isPending} onClick={save}>
            Save {saveCount(queue.length, node, tag)}
          </Button>
        </div>
      }
    >
      <div className="space-y-4 p-4 sm:p-5">
        {remaining > 0 && (
          <Callout tone="accent">
            {remaining} of the {wrong} wrong answers still to record.
          </Callout>
        )}

        {queue.length > 0 && (
          <ul className="divide-y divide-hairline rounded-md border border-hairline bg-canvas">
            {queue.map((row, index) => (
              <li key={index} className="flex items-center gap-2 px-3 py-2">
                <span className="min-w-0 flex-1 truncate text-sm text-ink">{row.title}</span>
                <Badge size="sm">
                  {TAGS.find((option) => option.value === row.tag)?.short}
                </Badge>
                <button
                  type="button"
                  onClick={() =>
                    setQueue((current) => current.filter((_, i) => i !== index))
                  }
                  aria-label={`Remove ${row.title}`}
                  className="shrink-0 rounded-md p-1 text-faint transition-colors hover:bg-danger-soft hover:text-danger"
                >
                  <X size={14} strokeWidth={2.2} />
                </button>
              </li>
            ))}
          </ul>
        )}

        <Field label="Topic">
          <NodePicker value={node} onChange={setNode} />
        </Field>

        <Field label="What kind of mistake?">
          <div className="grid gap-2 sm:grid-cols-2">
            {TAGS.map((option) => (
              <button
                key={option.value}
                type="button"
                aria-pressed={tag === option.value}
                onClick={() => setTag(option.value)}
                className={cn(
                  'h-10 rounded-md border px-3 text-left text-sm transition-colors',
                  tag === option.value
                    ? 'border-accent-ring bg-accent-soft font-medium text-accent'
                    : 'border-hairline text-muted hover:border-edge hover:text-ink',
                )}
              >
                {option.label}
              </button>
            ))}
          </div>
        </Field>

        <Field label="Question" hint="optional">
          <Input
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            placeholder="Which of the following are Fundamental Duties…"
          />
        </Field>

        <Field label="Why it went wrong" hint="optional">
          <Input
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder="Confused Art 51A(g) with (j)"
          />
        </Field>

        {error && <Callout tone="danger">{error}</Callout>}
      </div>
    </Sheet>
  )
}

function saveCount(queued: number, node: PickedNode | null, tag: MistakeTag | null): string {
  const total = queued + (node && tag ? 1 : 0)
  return total === 1 ? 'mistake' : `${total} mistakes`
}

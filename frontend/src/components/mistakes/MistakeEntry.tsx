import { useState } from 'react'

import { TAGS, type MistakeItem, type MistakeTag } from '@/api/mistakes'
import { NodePicker, type PickedNode } from '@/components/log/NodePicker'
import { Sheet } from '@/components/shell/Sheet'
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
    <Sheet title="Add mistakes" onClose={onClose}>
      <div className="max-h-[75vh] space-y-4 overflow-y-auto p-4">
        {remaining > 0 && (
          <p className="text-xs text-slate">
            {remaining} of the {wrong} wrong answers still to record.
          </p>
        )}

        {queue.length > 0 && (
          <ul className="rounded border border-line">
            {queue.map((row, index) => (
              <li
                key={index}
                className="flex items-center gap-2 border-b border-line px-3 py-2 last:border-0"
              >
                <span className="min-w-0 flex-1 truncate text-sm">{row.title}</span>
                <span className="shrink-0 text-xs text-slate">
                  {TAGS.find((option) => option.value === row.tag)?.short}
                </span>
                <button
                  type="button"
                  onClick={() =>
                    setQueue((current) => current.filter((_, i) => i !== index))
                  }
                  aria-label={`Remove ${row.title}`}
                  className="shrink-0 px-1 text-sm text-slate"
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
        )}

        <Field label="Topic">
          <NodePicker value={node} onChange={setNode} />
        </Field>

        <Field label="What kind of mistake?">
          <div className="grid grid-cols-2 gap-2">
            {TAGS.map((option) => (
              <button
                key={option.value}
                type="button"
                aria-pressed={tag === option.value}
                onClick={() => setTag(option.value)}
                className={[
                  'h-tap rounded border px-2 text-sm',
                  tag === option.value
                    ? 'border-signal bg-signal text-surface'
                    : 'border-line text-slate',
                ].join(' ')}
              >
                {option.label}
              </button>
            ))}
          </div>
        </Field>

        <Field label="Question (optional)">
          <input
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            placeholder="Which of the following are Fundamental Duties…"
            className="h-tap w-full rounded border border-line px-3 text-sm focus:border-signal"
          />
        </Field>

        <Field label="Why it went wrong (optional)">
          <input
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder="Confused Art 51A(g) with (j)"
            className="h-tap w-full rounded border border-line px-3 text-sm focus:border-signal"
          />
        </Field>

        {error && <p className="text-sm text-overdue">{error}</p>}

        <div className="flex gap-2">
          <button
            type="button"
            onClick={queueRow}
            className="h-tap flex-1 rounded border border-line text-sm"
          >
            Add another
          </button>
          <button
            type="button"
            onClick={save}
            disabled={add.isPending}
            className="h-tap flex-1 rounded bg-signal text-sm font-medium text-surface disabled:opacity-60"
          >
            {add.isPending ? 'Saving…' : `Save ${saveCount(queue.length, node, tag)}`}
          </button>
        </div>
      </div>
    </Sheet>
  )
}

function saveCount(queued: number, node: PickedNode | null, tag: MistakeTag | null): string {
  const total = queued + (node && tag ? 1 : 0)
  return total === 1 ? 'mistake' : `${total} mistakes`
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="pb-1.5 text-xs text-slate">{label}</p>
      {children}
    </div>
  )
}

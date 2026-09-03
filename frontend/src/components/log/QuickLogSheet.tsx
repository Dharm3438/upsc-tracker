import { useState } from 'react'

import type { LogPayload, LogType, ReviseMethod } from '@/api/logs'
import { Sheet } from '@/components/shell/Sheet'
import { toast } from '@/components/shell/Toast'
import {
  Button,
  Callout,
  ConfidenceScale,
  Field,
  NumberInput,
  SegmentedControl,
} from '@/components/ui'
import { useCreateLog } from '@/hooks/useLogs'
import { formatDayIST } from '@/lib/date'
import { readable } from '@/lib/errors'
import type { PickedNode } from './NodePicker'

/** The three types she can enter by hand. Answers and current affairs are
 *  logged by their own screens, which own the document the log points at. */
const TYPES: { value: LogType; label: string }[] = [
  { value: 'read', label: 'Read' },
  { value: 'revise', label: 'Revised' },
  { value: 'mcq', label: 'MCQs' },
]

const METHODS: { value: ReviseMethod; label: string }[] = [
  { value: 'recall', label: 'Recall' },
  { value: 'notes', label: 'Notes' },
  { value: 'book', label: 'Book' },
  { value: 'mindmap', label: 'Mind map' },
]

/** Pre-selected, so the common case is three taps: open, type, save. */
const DEFAULT_CONFIDENCE = 3

/**
 * Logging is always started from a topic — the syllabus row you opened is the
 * topic — so the sheet asks only what it cannot know: what kind of work, how
 * well it came back, and how long it took.
 */
export function QuickLogSheet({
  node,
  onClose,
}: {
  node: PickedNode
  onClose: () => void
}) {
  const [type, setType] = useState<LogType>('read')
  const [confidence, setConfidence] = useState(DEFAULT_CONFIDENCE)
  const [method, setMethod] = useState<ReviseMethod>('recall')
  const [attempted, setAttempted] = useState('')
  const [correct, setCorrect] = useState('')
  const [skipped, setSkipped] = useState('')
  const [minutes, setMinutes] = useState('')
  const [error, setError] = useState<string | null>(null)

  const create = useCreateLog()

  function payloadFor(): LogPayload {
    if (type === 'read') return { confidence }
    if (type === 'revise') return { confidence, method }
    return {
      attempted: number(attempted) ?? 0,
      correct: number(correct) ?? 0,
      skipped: number(skipped) ?? 0,
    }
  }

  function save() {
    if (type === 'mcq') {
      const a = number(attempted) ?? 0
      const c = number(correct) ?? 0
      if (a === 0) {
        setError('How many questions did you attempt?')
        return
      }
      if (c > a) {
        setError('More correct than attempted.')
        return
      }
    }
    setError(null)

    create.mutate(
      {
        node_id: node.id,
        type,
        minutes: number(minutes),
        payload: payloadFor(),
      },
      {
        onSuccess: (result) => {
          toast(
            result.next_due
              ? `Saved. Back on ${formatDayIST(result.next_due)}.`
              : 'Saved.',
          )
          onClose()
        },
        onError: (caught) => setError(readable(caught)),
      },
    )
  }

  return (
    <Sheet
      title="What did you do?"
      description={node.title}
      onClose={onClose}
      footer={
        <Button
          variant="primary"
          size="lg"
          full
          loading={create.isPending}
          onClick={save}
        >
          {saveLabel(type)}
        </Button>
      }
    >
      <div className="space-y-4 p-4 sm:p-5">
        <SegmentedControl full label="What kind of work" value={type} options={TYPES} onChange={setType} />

        {type === 'revise' && (
          <Field label="Method">
            <SegmentedControl full label="Method" value={method} options={METHODS} onChange={setMethod} />
          </Field>
        )}

        {type === 'mcq' && (
          <Field label="Questions">
            <div className="flex items-center gap-2">
              <NumberInput value={attempted} onChange={setAttempted} placeholder="Tried" />
              <NumberInput value={correct} onChange={setCorrect} placeholder="Right" />
              <NumberInput value={skipped} onChange={setSkipped} placeholder="Left" />
            </div>
          </Field>
        )}

        {type !== 'mcq' && (
          <Field label="How well did that come back?">
            <ConfidenceScale value={confidence} onChange={setConfidence} legend />
          </Field>
        )}

        <Field label="Minutes (optional)">
          <NumberInput value={minutes} onChange={setMinutes} placeholder="45" />
        </Field>

        {error && <Callout tone="danger">{error}</Callout>}
      </div>
    </Sheet>
  )
}

/** Buttons name the action that happens (plan §9). */
function saveLabel(type: LogType): string {
  if (type === 'read') return 'Save reading'
  if (type === 'revise') return 'Save revision'
  return 'Save questions'
}

function number(value: string): number | null {
  const parsed = Number.parseInt(value, 10)
  return Number.isFinite(parsed) ? parsed : null
}

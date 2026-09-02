import { useState } from 'react'

import type { LogPayload, LogType, ReviseMethod } from '@/api/logs'
import { Sheet } from '@/components/shell/Sheet'
import { toast } from '@/components/shell/Toast'
import {
  Button,
  Callout,
  ConfidenceScale,
  Field,
  Input,
  NumberInput,
  SegmentedControl,
} from '@/components/ui'
import { useCreateLog } from '@/hooks/useLogs'
import { formatDayIST } from '@/lib/date'
import { readable } from '@/lib/errors'
import { NodePicker, type PickedNode } from './NodePicker'

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

/** Remembering the last book means the source field is usually already right. */
const LAST_SOURCE_KEY = 'upsc.lastSource'

/** Pre-selected, so the common case is four taps: open, type, topic, save. */
const DEFAULT_CONFIDENCE = 3

export function QuickLogSheet({
  onClose,
  initialNode = null,
}: {
  onClose: () => void
  initialNode?: PickedNode | null
}) {
  const [type, setType] = useState<LogType>('read')
  const [node, setNode] = useState<PickedNode | null>(initialNode)
  const [confidence, setConfidence] = useState(DEFAULT_CONFIDENCE)
  const [method, setMethod] = useState<ReviseMethod>('recall')
  const [source, setSource] = useState(() => localStorage.getItem(LAST_SOURCE_KEY) ?? '')
  const [fromPage, setFromPage] = useState('')
  const [toPage, setToPage] = useState('')
  const [attempted, setAttempted] = useState('')
  const [correct, setCorrect] = useState('')
  const [skipped, setSkipped] = useState('')
  const [minutes, setMinutes] = useState('')
  const [error, setError] = useState<string | null>(null)

  const create = useCreateLog()

  function payloadFor(): LogPayload {
    if (type === 'read') {
      return {
        source: source.trim(),
        from_page: number(fromPage),
        to_page: number(toPage),
        confidence,
      }
    }
    if (type === 'revise') return { confidence, method }
    return {
      attempted: number(attempted) ?? 0,
      correct: number(correct) ?? 0,
      skipped: number(skipped) ?? 0,
    }
  }

  function save() {
    if (!node) {
      setError('Pick a topic first.')
      return
    }
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

    if (type === 'read' && source.trim()) {
      localStorage.setItem(LAST_SOURCE_KEY, source.trim())
    }

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
      description="Four taps on a normal day."
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

        <Field label="Topic">
          <NodePicker value={node} onChange={setNode} />
        </Field>

        {type === 'read' && (
          <>
            <Field label="Source">
              <Input
                value={source}
                onChange={(event) => setSource(event.target.value)}
                placeholder="Laxmikanth"
              />
            </Field>
            <Field label="Pages">
              <div className="flex items-center gap-2">
                <NumberInput value={fromPage} onChange={setFromPage} placeholder="204" />
                <span className="text-sm text-muted">to</span>
                <NumberInput value={toPage} onChange={setToPage} placeholder="231" />
              </div>
            </Field>
          </>
        )}

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

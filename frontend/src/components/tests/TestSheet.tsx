import { useState } from 'react'

import type { Paper } from '@/api/syllabus'
import { TEST_KINDS, type NewTest, type Test, type TestKind } from '@/api/tests'
import { Sheet } from '@/components/shell/Sheet'
import { toast } from '@/components/shell/Toast'
import { Button, Callout, Chip, Field, Input, NumberInput, Textarea } from '@/components/ui'
import { useCreateTest, useUpdateTest } from '@/hooks/useTests'
import { todayIST } from '@/lib/date'
import { readable } from '@/lib/errors'

const PAPERS: Paper[] = ['GS1', 'GS2', 'GS3', 'GS4', 'CSAT']

/** She has a score sheet in front of her: three numbers, then done. Marks,
 *  duration and notes are optional and sit below the fold of attention. */
export function TestSheet({
  existing,
  onClose,
  onSaved,
}: {
  existing?: Test
  onClose: () => void
  onSaved?: (test: Test) => void
}) {
  const [title, setTitle] = useState(existing?.title ?? '')
  const [date, setDate] = useState(existing?.date ?? todayIST())
  const [kind, setKind] = useState<TestKind>(existing?.kind ?? 'sectional')
  const [papers, setPapers] = useState<Paper[]>(existing?.papers ?? [])
  const [total, setTotal] = useState(String(existing?.total_questions ?? 100))
  const [attempted, setAttempted] = useState(
    existing ? String(existing.attempted) : '',
  )
  const [correct, setCorrect] = useState(existing ? String(existing.correct) : '')
  const [maxMarks, setMaxMarks] = useState(
    existing?.max_marks != null ? String(existing.max_marks) : '200',
  )
  const [minutes, setMinutes] = useState(
    existing?.duration_minutes != null ? String(existing.duration_minutes) : '',
  )
  const [notes, setNotes] = useState(existing?.notes ?? '')
  const [error, setError] = useState<string | null>(null)

  const create = useCreateTest()
  const update = useUpdateTest(existing?._id ?? '')
  const saving = create.isPending || update.isPending

  function save() {
    const counts = {
      total_questions: number(total) ?? 0,
      attempted: number(attempted) ?? 0,
      correct: number(correct) ?? 0,
    }
    if (!title.trim()) return setError('Give the paper a name you will recognise.')
    if (counts.total_questions < 1) return setError('How many questions were in it?')
    if (counts.attempted > counts.total_questions) {
      return setError('More attempted than the paper had.')
    }
    if (counts.correct > counts.attempted) {
      return setError('More correct than attempted.')
    }
    setError(null)

    const body: NewTest = {
      title: title.trim(),
      date,
      kind,
      papers,
      ...counts,
      max_marks: number(maxMarks),
      duration_minutes: number(minutes),
      notes: notes.trim(),
    }

    const mutation = existing ? update : create
    mutation.mutate(body, {
      onSuccess: (saved) => {
        toast(existing ? 'Attempt updated.' : 'Attempt saved.')
        onSaved?.(saved)
        onClose()
      },
      onError: (caught) => setError(readable(caught)),
    })
  }

  return (
    <Sheet
      title={existing ? 'Edit attempt' : 'Add a test'}
      description="Three numbers and the rest is worked out."
      onClose={onClose}
      footer={
        <Button variant="primary" size="lg" full loading={saving} onClick={save}>
          {existing ? 'Save changes' : 'Save attempt'}
        </Button>
      }
    >
      <div className="space-y-4 p-4 sm:p-5">
        <Field label="Paper">
          <Input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="Vision IAS PT Test 6"
          />
        </Field>

        <Field label="Kind">
          <div className="flex flex-wrap gap-2">
            {TEST_KINDS.map((option) => (
              <Chip
                key={option.value}
                selected={kind === option.value}
                onClick={() => setKind(option.value)}
              >
                {option.label}
              </Chip>
            ))}
          </div>
        </Field>

        <Field label="Covering">
          <div className="flex flex-wrap gap-2">
            {PAPERS.map((option) => (
              <Chip
                key={option}
                selected={papers.includes(option)}
                onClick={() =>
                  setPapers((current) =>
                    current.includes(option)
                      ? current.filter((paper) => paper !== option)
                      : [...current, option],
                  )
                }
              >
                {option}
              </Chip>
            ))}
          </div>
        </Field>

        <Field
          label="Questions"
          hint="in the paper · attempted · correct"
        >
          <div className="grid grid-cols-3 gap-2">
            <NumberInput value={total} onChange={setTotal} placeholder="100" />
            <NumberInput value={attempted} onChange={setAttempted} placeholder="84" />
            <NumberInput value={correct} onChange={setCorrect} placeholder="57" />
          </div>
          <p className="pt-1.5 text-xs text-muted">
            Wrong, skipped, accuracy and the score are worked out from these.
          </p>
        </Field>

        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Date">
            <Input
              type="date"
              value={date}
              onChange={(event) => setDate(event.target.value)}
            />
          </Field>
          <Field label="Max marks">
            <NumberInput value={maxMarks} onChange={setMaxMarks} placeholder="200" />
          </Field>
          <Field label="Minutes">
            <NumberInput value={minutes} onChange={setMinutes} placeholder="120" />
          </Field>
        </div>

        <Field label="Notes" hint="optional">
          <Textarea
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            rows={2}
            placeholder="Ran out of time on the last 20."
          />
        </Field>

        {error && <Callout tone="danger">{error}</Callout>}
      </div>
    </Sheet>
  )
}

function number(value: string): number | null {
  const parsed = Number.parseInt(value, 10)
  return Number.isFinite(parsed) ? parsed : null
}

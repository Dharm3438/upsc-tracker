import { useState } from 'react'
import { ClipboardList, NotebookPen, Pencil, Plus, Target, Trash2 } from 'lucide-react'
import { useNavigate, useParams } from 'react-router-dom'

import { percent } from '@/components/charts/Sparkline'
import { MistakeEntry } from '@/components/mistakes/MistakeEntry'
import { MistakeList } from '@/components/mistakes/MistakeList'
import { TestSheet } from '@/components/tests/TestSheet'
import { toast } from '@/components/shell/Toast'
import {
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  DataRow,
  ErrorState,
  PageHeader,
  SkeletonText,
} from '@/components/ui'
import { useMistakes } from '@/hooks/useMistakes'
import { useDeleteTest, useTest } from '@/hooks/useTests'
import { formatDayIST } from '@/lib/date'
import { readable } from '@/lib/errors'

export function TestDetail() {
  const { testId } = useParams()
  const navigate = useNavigate()
  const test = useTest(testId)
  const mistakes = useMistakes({ sourceId: testId })
  const remove = useDeleteTest()

  const [editing, setEditing] = useState(false)
  const [adding, setAdding] = useState(false)

  if (test.isError) {
    return (
      <Card>
        <ErrorState title="Could not load that attempt." onRetry={test.refetch} />
      </Card>
    )
  }
  if (!test.data) {
    return (
      <Card>
        <CardBody>
          <SkeletonText lines={4} />
        </CardBody>
      </Card>
    )
  }

  const attempt = test.data
  const unrecorded = attempt.wrong - attempt.mistakes_logged
  const total = Math.max(1, attempt.total_questions)

  return (
    <>
      <PageHeader
        back={{ label: 'Practice', to: '/practice' }}
        title={attempt.title}
        meta={
          <>
            <Badge tone="outline">{formatDayIST(attempt.date)}</Badge>
            {attempt.papers.map((paper) => (
              <Badge key={paper}>{paper}</Badge>
            ))}
            {attempt.duration_minutes && <Badge>{attempt.duration_minutes} min</Badge>}
          </>
        }
        actions={
          <>
            <Button icon={<Pencil size={15} strokeWidth={1.9} />} onClick={() => setEditing(true)}>
              Edit
            </Button>
            <Button
              variant="primary"
              icon={<Plus size={15} strokeWidth={2.2} />}
              onClick={() => setAdding(true)}
            >
              Add mistakes
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-12 items-start gap-4 lg:gap-5">
        <div className="col-span-12 space-y-4 lg:col-span-4 lg:space-y-5">
          <Card>
            <CardHeader title="Score" icon={<Target size={17} strokeWidth={1.8} />} />
            <div>
              <DataRow
                label="Marks"
                value={
                  attempt.marks === null
                    ? '—'
                    : `${attempt.marks}${attempt.max_marks ? ` / ${attempt.max_marks}` : ''}`
                }
              />
              <DataRow label="Accuracy" value={percent(attempt.accuracy)} />
              <DataRow
                label="Attempted"
                value={`${attempt.attempted} of ${attempt.total_questions}`}
              />
            </div>
            <CardBody>
              {/* Right, wrong and left as one bar: three numbers in a row make
                  you do the arithmetic, a bar does it for you. */}
              <div className="flex h-2.5 overflow-hidden rounded-full bg-hairline">
                <span
                  className="bg-success"
                  style={{ width: `${(attempt.correct / total) * 100}%` }}
                />
                <span
                  className="bg-danger"
                  style={{ width: `${(attempt.wrong / total) * 100}%` }}
                />
              </div>
              <p className="mt-2.5 flex flex-wrap gap-x-4 gap-y-1 text-xs tabular-nums text-muted">
                <span className="text-success">{attempt.correct} right</span>
                <span className="text-danger">{attempt.wrong} wrong</span>
                <span>{attempt.skipped} left</span>
              </p>
            </CardBody>
          </Card>

          {attempt.notes && (
            <Card>
              <CardHeader title="Notes" icon={<NotebookPen size={17} strokeWidth={1.8} />} />
              <CardBody>
                <p className="whitespace-pre-wrap text-sm text-ink">{attempt.notes}</p>
              </CardBody>
            </Card>
          )}

          <Button
            variant="danger"
            full
            icon={<Trash2 size={15} strokeWidth={1.9} />}
            loading={remove.isPending}
            onClick={() => {
              if (!window.confirm('Delete this attempt and its mistakes?')) return
              remove.mutate(attempt._id, {
                onSuccess: () => {
                  toast('Attempt deleted.')
                  navigate('/practice')
                },
                onError: (caught) => toast(readable(caught), 'error'),
              })
            }}
          >
            Delete attempt
          </Button>
        </div>

        <Card className="col-span-12 lg:col-span-8">
          <CardHeader
            title="Mistakes"
            count={attempt.mistakes_logged}
            icon={<ClipboardList size={17} strokeWidth={1.8} />}
            action={
              unrecorded > 0 && <Badge tone="danger">{unrecorded} still to record</Badge>
            }
          />
          <MistakeList
            query={mistakes}
            empty="Nothing recorded yet. The patterns are more useful than the score."
            showTopic
          />
        </Card>
      </div>

      {editing && <TestSheet existing={attempt} onClose={() => setEditing(false)} />}
      {adding && (
        <MistakeEntry
          testId={attempt._id}
          wrong={attempt.wrong}
          alreadyLogged={attempt.mistakes_logged}
          onClose={() => setAdding(false)}
        />
      )}
    </>
  )
}

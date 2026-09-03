import { useEffect, useRef, useState } from 'react'
import { Check, Clock, History, Loader2, NotebookPen, Plus, Shapes, Sparkles } from 'lucide-react'
import { useParams } from 'react-router-dom'

import { QuickLogSheet } from '@/components/log/QuickLogSheet'
import { Timeline } from '@/components/log/Timeline'
import {
  Badge,
  Button,
  Callout,
  Card,
  CardBody,
  CardHeader,
  DataRow,
  ErrorState,
  ProgressBar,
  SkeletonText,
  Textarea,
} from '@/components/ui'
import { useNode, useUpdateNode } from '@/hooks/useSyllabus'
import { daysUntil, formatDayIST } from '@/lib/date'
import { ATTENTION_DAYS } from '@/lib/tokens'

/**
 * Rendered as the right-hand pane of the syllabus workspace on a desktop and as
 * the whole screen on a phone — one component, both contexts. There is no
 * `navigate(-1)` here on purpose: as a pane, "back" would leave the section.
 */
export function NodeDetail() {
  const { nodeId } = useParams()
  const node = useNode(nodeId)
  const [logging, setLogging] = useState(false)

  if (node.isError) {
    return (
      <Card>
        <ErrorState title="Could not load that topic." onRetry={node.refetch} />
      </Card>
    )
  }

  if (!node.data) {
    return (
      <Card>
        <CardBody>
          <SkeletonText lines={4} />
        </CardBody>
      </Card>
    )
  }

  const data = node.data
  const crumbs = data.path.split('/').slice(0, -1)
  const overdueBy = data.next_due ? -daysUntil(data.next_due) : 0

  return (
    <>
      <div className="space-y-4 lg:space-y-5">
        <div>
          <p className="truncate text-xs text-faint">{crumbs.join(' › ')}</p>
          <h1 className="mt-1 font-display text-2xl font-semibold leading-tight text-ink">
            {data.title}
          </h1>
          <div className="mt-2.5 flex flex-wrap items-center gap-2">
            <Badge tone={data.pyq_weight === 'high' ? 'accent' : 'neutral'}>
              PYQ weight: {data.pyq_weight}
            </Badge>
            {data.needs_diagram && (
              <Badge tone="outline" icon={<Shapes size={12} strokeWidth={2} />}>
                Diagram carries marks
              </Badge>
            )}
            {data.is_custom && (
              <Badge tone="outline" icon={<Sparkles size={12} strokeWidth={2} />}>
                Your own topic
              </Badge>
            )}
          </div>
        </div>

        {overdueBy > ATTENTION_DAYS && (
          <Callout tone="danger" icon={Clock}>
            {overdueBy} days overdue. The interval will reset when you grade it.
          </Callout>
        )}

        <div className="grid gap-4 lg:grid-cols-2 lg:gap-5">
          <Card>
            <CardHeader
              title="Revision"
              icon={<Clock size={17} strokeWidth={1.8} />}
              action={
                <Button
                  size="sm"
                  variant="primary"
                  icon={<Plus size={14} strokeWidth={2.2} />}
                  onClick={() => setLogging(true)}
                >
                  Log
                </Button>
              }
            />
            <div>
              <DataRow
                label="Confidence"
                value={
                  data.confidence ? (
                    <>
                      <span className="block w-14">
                        <ProgressBar size="sm" value={data.confidence} max={5} />
                      </span>
                      {data.confidence} / 5
                    </>
                  ) : (
                    'not graded yet'
                  )
                }
              />
              <DataRow
                label="Next due"
                tone={overdueBy > 0 ? 'danger' : 'default'}
                value={dueLabel(data.next_due)}
              />
              <DataRow
                label="Logged"
                value={
                  data.read_count + data.revise_count === 0
                    ? 'nothing yet'
                    : `${data.read_count} read · ${data.revise_count} revised`
                }
              />
              {data.mcq_accuracy !== null && (
                <DataRow label="MCQ accuracy" value={`${Math.round(data.mcq_accuracy * 100)}%`} />
              )}
            </div>
          </Card>

          <Card>
            <CardHeader title="Your notes" icon={<NotebookPen size={17} strokeWidth={1.8} />} />
            <CardBody>
              <NodeNotes nodeId={data._id} initial={data.notes} />
            </CardBody>
          </Card>
        </div>

        <Card>
          <CardHeader
            title="Timeline"
            subtitle="Everything logged against this topic, newest first."
            icon={<History size={17} strokeWidth={1.8} />}
          />
          <Timeline nodeId={data._id} />
        </Card>
      </div>

      {logging && (
        <QuickLogSheet
          onClose={() => setLogging(false)}
          initialNode={{ id: data._id, title: data.title, path: data.path }}
        />
      )}
    </>
  )
}

/** Overdue is worth saying out loud; a bare past date reads as fine. */
function dueLabel(nextDue: string | null): string {
  if (!nextDue) return '—'
  const days = daysUntil(nextDue)
  if (days === 0) return 'today'
  if (days === 1) return 'tomorrow'
  if (days < 0) return `${formatDayIST(nextDue)} · ${-days} days overdue`
  return `${formatDayIST(nextDue)} · in ${days} days`
}

/** Autosaving textarea: a save button here would cost a tap she would forget. */
function NodeNotes({ nodeId, initial }: { nodeId: string; initial: string }) {
  const [text, setText] = useState(initial)
  const [saved, setSaved] = useState(true)
  const update = useUpdateNode()
  const timer = useRef<number>()

  useEffect(() => {
    setText(initial)
    setSaved(true)
  }, [initial, nodeId])

  useEffect(() => () => window.clearTimeout(timer.current), [])

  function change(value: string) {
    setText(value)
    setSaved(false)
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => {
      update.mutate({ id: nodeId, patch: { notes: value } }, { onSuccess: () => setSaved(true) })
    }, 800)
  }

  return (
    <>
      <Textarea
        value={text}
        onChange={(event) => change(event.target.value)}
        rows={5}
        placeholder="Anything worth remembering about this topic. It is shown as the prompt when you grade it."
      />
      <p className="mt-1.5 flex items-center gap-1.5 text-xs text-faint">
        {saved ? (
          <>
            <Check size={12} strokeWidth={2.4} /> Saved
          </>
        ) : (
          <>
            <Loader2 size={12} strokeWidth={2.4} className="animate-spin" /> Saving…
          </>
        )}
      </p>
    </>
  )
}

import { useState } from 'react'
import { Check, ClipboardList, ListChecks, Target, X } from 'lucide-react'

import { formatMinutes } from '@/api/progress'
import type { Week as WeekData, WeekPlan, WeekTargets } from '@/api/week'
import { toast } from '@/components/shell/Toast'
import { Sheet } from '@/components/shell/Sheet'
import { NodePicker } from '@/components/log/NodePicker'
import { WeeklyReviewCard } from '@/components/week/WeeklyReviewCard'
import {
  Button,
  Card,
  CardHeader,
  EmptyState,
  Field,
  NumberInput,
  PageHeader,
  QueryBoundary,
  SkeletonRows,
  StatTile,
} from '@/components/ui'
import { useSaveWeekPlan, useWeek } from '@/hooks/useWeek'
import { formatDayIST } from '@/lib/date'

/**
 * The week she has planned, against the week she has had. Always the current
 * one — a past week is a note in the review, not a screen to navigate back to.
 *
 * Two kinds of target sit here for two different reasons. The four numbers are
 * habits, and are hers to set. The topic list is the actual plan, and it ticks
 * itself off the logs: a checkbox she has to remember to tick is a second place
 * for the truth to live.
 */
export function Week() {
  const week = useWeek()

  return (
    <>
      <PageHeader
        title="This week"
        subtitle={
          week.data
            ? `${formatDayIST(week.data.week_start)} – ${formatDayIST(
                week.data.week_end,
              )} · ${week.data.study_days} study days`
            : undefined
        }
      />

      <QueryBoundary
        query={week}
        error="Could not load the week."
        skeleton={<SkeletonRows rows={6} />}
      >
        {(data) => <WeekBody week={data} />}
      </QueryBoundary>
    </>
  )
}

function WeekBody({ week }: { week: WeekData }) {
  const save = useSaveWeekPlan()
  const [editing, setEditing] = useState(false)

  /** Every write sends the whole plan, so both halves of the page save the
   *  same way and neither can overwrite the other with a stale copy. */
  function persist(changes: Partial<WeekPlan>, done?: () => void) {
    save.mutate(
      {
        week_start: week.week_start,
        targets: week.targets,
        commitments: week.commitments.map((item) => item.node_id),
        ...changes,
      },
      {
        onSuccess: () => done?.(),
        onError: () => toast('Could not save that.', 'error'),
      },
    )
  }

  return (
    <>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3 lg:mb-4">
        <p className="text-sm text-muted">
          <span className="font-medium text-ink">{week.suggested.new_topics} new topics</span>{' '}
          and{' '}
          <span className="font-medium text-ink">
            {formatMinutes(week.suggested.study_minutes)}
          </span>{' '}
          keeps you on pace for Prelims across {week.study_days} study days.
        </p>
        <Button
          variant="secondary"
          size="sm"
          icon={<Target size={14} strokeWidth={2} />}
          onClick={() => setEditing(true)}
        >
          Targets
        </Button>
      </div>

      <div className="mb-4 grid grid-cols-2 gap-3 lg:mb-5 lg:grid-cols-4 lg:gap-5">
        <TargetTile
          label="New topics"
          done={week.actuals.new_topics}
          target={week.targets.new_topics}
        />
        <TargetTile
          label="Answers"
          done={week.actuals.answers}
          target={week.targets.answers}
        />
        <TargetTile label="MCQs" done={week.actuals.mcqs} target={week.targets.mcqs} />
        <TargetTile
          label="Studied"
          done={week.actuals.study_minutes}
          target={week.targets.study_minutes}
          format={formatMinutes}
        />
      </div>

      <div className="grid grid-cols-12 items-start gap-4 lg:gap-5">
        <Card className="col-span-12">
          <CardHeader
            title="Topics this week"
            subtitle="Ticked by the log, not by hand."
            icon={<ListChecks size={17} strokeWidth={1.8} />}
            count={week.commitments.length}
          />
          <Commitments week={week} onChange={persist} saving={save.isPending} />
        </Card>

        <Card className="col-span-12">
          <CardHeader
            title="Weekly review"
            subtitle="Three questions, written once a week."
            icon={<ClipboardList size={17} strokeWidth={1.8} />}
          />
          <WeeklyReviewCard />
        </Card>
      </div>

      {editing && (
        <TargetSheet
          targets={week.targets}
          saving={save.isPending}
          onClose={() => setEditing(false)}
          onSave={(targets) => persist({ targets }, () => setEditing(false))}
        />
      )}
    </>
  )
}

/** A figure with its target under it, or on its own when none is set. */
function TargetTile({
  label,
  done,
  target,
  format = (value: number) => String(value),
}: {
  label: string
  done: number
  target: number | null
  format?: (value: number) => string
}) {
  // A target of zero is not a target; it draws no meter either.
  const tracked = target !== null && target > 0

  return (
    <StatTile
      label={label}
      value={format(done)}
      sub={tracked ? `of ${format(target)}` : 'No target'}
      progress={tracked ? { value: done, max: target } : undefined}
    />
  )
}

function Commitments({
  week,
  onChange,
  saving,
}: {
  week: WeekData
  onChange: (changes: Partial<WeekPlan>) => void
  saving: boolean
}) {
  const ids = week.commitments.map((item) => item.node_id)

  return (
    <>
      {week.commitments.length === 0 ? (
        <EmptyState
          size="sm"
          title="Nothing picked yet."
          description="Choose the topics you mean to cover, and they tick themselves as you log them."
        />
      ) : (
        <ul className="divide-y divide-hairline">
          {week.commitments.map((item) => (
            <li key={item.node_id} className="flex items-center gap-3 px-4 py-2.5 sm:px-5">
              <span
                className={
                  item.done
                    ? 'flex size-5 shrink-0 items-center justify-center rounded-full bg-success-soft text-success'
                    : 'size-5 shrink-0 rounded-full border border-dashed border-edge'
                }
                aria-hidden
              >
                {item.done && <Check size={13} strokeWidth={2.5} />}
              </span>
              <span className="min-w-0 flex-1">
                <span
                  className={
                    item.done
                      ? 'block truncate text-sm text-muted line-through'
                      : 'block truncate text-sm text-ink'
                  }
                >
                  {item.title}
                </span>
                <span className="block truncate text-xs text-faint">{item.path}</span>
              </span>
              <button
                type="button"
                disabled={saving}
                aria-label={`Remove ${item.title}`}
                onClick={() =>
                  onChange({ commitments: ids.filter((id) => id !== item.node_id) })
                }
                className="shrink-0 rounded-md p-1.5 text-faint transition-colors hover:bg-canvas hover:text-ink disabled:opacity-50"
              >
                <X size={15} strokeWidth={2} />
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="border-t border-hairline p-4 sm:p-5">
        <Field label="Add a topic">
          <NodePicker
            value={null}
            onChange={(node) => {
              if (ids.includes(node.id)) return
              onChange({ commitments: [...ids, node.id] })
            }}
          />
        </Field>
      </div>
    </>
  )
}

/** Four fields, all optional. An empty one clears the target rather than
 *  storing a zero. */
function TargetSheet({
  targets,
  saving,
  onClose,
  onSave,
}: {
  targets: WeekTargets
  saving: boolean
  onClose: () => void
  onSave: (targets: WeekTargets) => void
}) {
  const toText = (value: number | null) => (value === null ? '' : String(value))
  const [draft, setDraft] = useState({
    new_topics: toText(targets.new_topics),
    answers: toText(targets.answers),
    mcqs: toText(targets.mcqs),
    hours: targets.study_minutes === null ? '' : String(targets.study_minutes / 60),
  })

  const toNumber = (value: string) => (value.trim() === '' ? null : Number(value))

  function submit() {
    const hours = toNumber(draft.hours)
    onSave({
      new_topics: toNumber(draft.new_topics),
      answers: toNumber(draft.answers),
      mcqs: toNumber(draft.mcqs),
      study_minutes: hours === null ? null : Math.round(hours * 60),
    })
  }

  return (
    <Sheet
      title="Targets for this week"
      description="Leave a field blank to stop tracking it."
      size="sm"
      onClose={onClose}
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" onClick={submit} loading={saving}>
            Save targets
          </Button>
        </div>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="New topics">
          <NumberInput
            value={draft.new_topics}
            onChange={(value) => setDraft({ ...draft, new_topics: value })}
          />
        </Field>
        <Field label="Answers">
          <NumberInput
            value={draft.answers}
            onChange={(value) => setDraft({ ...draft, answers: value })}
          />
        </Field>
        <Field label="MCQs">
          <NumberInput
            value={draft.mcqs}
            onChange={(value) => setDraft({ ...draft, mcqs: value })}
          />
        </Field>
        <Field label="Study time">
          <NumberInput
            value={draft.hours}
            onChange={(value) => setDraft({ ...draft, hours: value })}
            decimals
            suffix="hrs"
          />
        </Field>
      </div>
    </Sheet>
  )
}

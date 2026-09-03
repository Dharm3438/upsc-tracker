import { useEffect, useState } from 'react'
import { CalendarOff, CalendarRange, ClipboardList, Lock, Plus, Target, X } from 'lucide-react'

import type { AppSettings, DailyTargets } from '@/api/settings'
import { weekdayName } from '@/api/settings'
import { UNAUTHORIZED_EVENT, clearApiKey, getApiKey } from '@/api/client'
import { toast } from '@/components/shell/Toast'
import {
  Button,
  Card,
  CardBody,
  CardHeader,
  Chip,
  ChipRow,
  Field,
  Input,
  NumberInput,
  PageHeader,
  QueryBoundary,
  SkeletonText,
} from '@/components/ui'
import { useSaveWeeklyReview, useSettings, useUpdateSettings, useWeeklyReviews } from '@/hooks/useSettings'
import { formatDayIST } from '@/lib/date'
import { readable } from '@/lib/errors'

const TARGETS: { key: keyof DailyTargets; label: string; suffix?: string }[] = [
  { key: 'revision_nodes', label: 'Topics to revise' },
  { key: 'answers', label: 'Answers to write' },
  { key: 'mcqs', label: 'MCQs to attempt' },
  { key: 'ca_items', label: 'Current affairs to capture' },
  { key: 'study_minutes', label: 'Study time', suffix: 'min' },
]

/**
 * The screen the gear in the top bar has been pointing at nothing for. Every
 * figure here moves the pace maths on Progress and the countdown on Today,
 * which is why `useUpdateSettings` already invalidates all three.
 */
export function Settings() {
  const settings = useSettings()

  return (
    <>
      <PageHeader
        title="Settings"
        eyebrow="Your setup"
        subtitle="Exam dates and off-days drive every pace figure in the app."
      />
      <QueryBoundary
        query={settings}
        error="Could not load your settings."
        skeleton={<SkeletonText lines={6} />}
      >
        {(data) => <SettingsForm settings={data} />}
      </QueryBoundary>
    </>
  )
}

function SettingsForm({ settings }: { settings: AppSettings }) {
  const update = useUpdateSettings()
  const [draft, setDraft] = useState(settings)
  const [newOffDay, setNewOffDay] = useState('')
  const [error, setError] = useState<string | null>(null)

  // A refetch that lands while she is typing should not overwrite the field she
  // is in, so this only resyncs when the saved document actually changes.
  useEffect(() => setDraft(settings), [settings])

  const dirty = JSON.stringify(draft) !== JSON.stringify(settings)

  function save() {
    setError(null)
    update.mutate(
      {
        prelims_date: draft.prelims_date,
        mains_date: draft.mains_date,
        daily_targets: draft.daily_targets,
        off_days: draft.off_days,
        weekly_off_weekday: draft.weekly_off_weekday,
      },
      {
        onSuccess: () => toast('Settings saved.'),
        onError: (caught) => setError(readable(caught)),
      },
    )
  }

  function addOffDay() {
    const day = newOffDay.trim()
    if (!day || draft.off_days.includes(day)) return
    setDraft({ ...draft, off_days: [...draft.off_days, day].sort() })
    setNewOffDay('')
  }

  return (
    <div className="grid grid-cols-12 items-start gap-4 lg:gap-5">
      <Card className="col-span-12 lg:col-span-6">
        <CardHeader
          title="Exam dates"
          subtitle="The two dates the countdown and the burn-down measure against."
          icon={<CalendarRange size={17} strokeWidth={1.8} />}
        />
        <CardBody className="grid gap-4 sm:grid-cols-2">
          <Field label="Prelims" htmlFor="prelims">
            <Input
              id="prelims"
              type="date"
              value={draft.prelims_date}
              onChange={(event) => setDraft({ ...draft, prelims_date: event.target.value })}
            />
          </Field>
          <Field label="Mains" htmlFor="mains">
            <Input
              id="mains"
              type="date"
              value={draft.mains_date}
              onChange={(event) => setDraft({ ...draft, mains_date: event.target.value })}
            />
          </Field>
        </CardBody>
      </Card>

      <Card className="col-span-12 lg:col-span-6">
        <CardHeader
          title="Daily targets"
          subtitle="What a full day looks like. The dashboard measures against these."
          icon={<Target size={17} strokeWidth={1.8} />}
        />
        <CardBody className="grid gap-4 sm:grid-cols-2">
          {TARGETS.map((target) => (
            <Field key={target.key} label={target.label}>
              <NumberInput
                value={String(draft.daily_targets[target.key])}
                suffix={target.suffix}
                onChange={(value) =>
                  setDraft({
                    ...draft,
                    daily_targets: {
                      ...draft.daily_targets,
                      [target.key]: Number.parseInt(value, 10) || 0,
                    },
                  })
                }
              />
            </Field>
          ))}
        </CardBody>
      </Card>

      <Card className="col-span-12 lg:col-span-7">
        <CardHeader
          title="Off days"
          subtitle="Days taken out of the pace maths rather than counted as a zero."
          icon={<CalendarOff size={17} strokeWidth={1.8} />}
        />
        <CardBody className="space-y-5">
          <Field label="Standing weekly off" hint={weekdayName(draft.weekly_off_weekday)}>
            <ChipRow>
              <Chip
                selected={draft.weekly_off_weekday === null}
                onClick={() => setDraft({ ...draft, weekly_off_weekday: null })}
              >
                None
              </Chip>
              {[0, 1, 2, 3, 4, 5, 6].map((day) => (
                <Chip
                  key={day}
                  selected={draft.weekly_off_weekday === day}
                  onClick={() => setDraft({ ...draft, weekly_off_weekday: day })}
                >
                  {weekdayName(day).slice(0, 3)}
                </Chip>
              ))}
            </ChipRow>
          </Field>

          <Field label="One-off days" hint={`${draft.off_days.length} planned`}>
            <div className="flex gap-2">
              <Input
                type="date"
                value={newOffDay}
                onChange={(event) => setNewOffDay(event.target.value)}
                className="max-w-[200px]"
              />
              <Button icon={<Plus size={15} />} onClick={addOffDay} disabled={!newOffDay}>
                Add
              </Button>
            </div>
            {draft.off_days.length > 0 && (
              <div className="flex flex-wrap gap-2 pt-3">
                {draft.off_days.map((day) => (
                  <span
                    key={day}
                    className="inline-flex items-center gap-1.5 rounded-full border border-hairline bg-canvas py-1 pl-3 pr-1.5 text-sm text-muted"
                  >
                    {formatDayIST(day)}
                    <button
                      type="button"
                      aria-label={`Remove ${day}`}
                      onClick={() =>
                        setDraft({ ...draft, off_days: draft.off_days.filter((d) => d !== day) })
                      }
                      className="rounded-full p-0.5 text-faint transition-colors hover:bg-danger-soft hover:text-danger"
                    >
                      <X size={13} strokeWidth={2.2} />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </Field>
        </CardBody>
      </Card>

      <DeviceCard />

      <div className="col-span-12 flex flex-wrap items-center gap-3">
        <Button variant="primary" onClick={save} loading={update.isPending} disabled={!dirty}>
          {dirty ? 'Save changes' : 'Saved'}
        </Button>
        {dirty && (
          <Button variant="ghost" onClick={() => setDraft(settings)}>
            Discard
          </Button>
        )}
        {error && <p className="text-sm text-danger">{error}</p>}
      </div>

      <WeeklyReviewHistory />
    </div>
  )
}

function DeviceCard() {
  const key = getApiKey() ?? ''
  const masked = key.length > 8 ? `${key.slice(0, 4)}${'•'.repeat(12)}${key.slice(-4)}` : '••••••••'

  return (
    <Card className="col-span-12 lg:col-span-5">
      <CardHeader
        title="This device"
        subtitle="The key is kept in this browser and nowhere else."
        icon={<Lock size={17} strokeWidth={1.8} />}
      />
      <CardBody className="space-y-4">
        <Field label="API key">
          <p className="rounded-md border border-hairline bg-canvas px-3 py-2.5 font-mono text-sm text-muted">
            {masked}
          </p>
        </Field>
        <Button
          variant="danger"
          icon={<Lock size={15} />}
          onClick={() => {
            clearApiKey()
            window.dispatchEvent(new Event(UNAUTHORIZED_EVENT))
          }}
        >
          Lock this device
        </Button>
      </CardBody>
    </Card>
  )
}

/** The weekly reviews are written on Progress; this is where the old ones live,
 *  because nine months of them do not belong on a screen read every Sunday. */
function WeeklyReviewHistory() {
  const reviews = useWeeklyReviews()
  // Referenced so the hook module keeps one obvious consumer per export.
  useSaveWeeklyReview()

  return (
    <Card className="col-span-12">
      <CardHeader
        title="Past weekly reviews"
        subtitle="Written on the Progress screen, kept here."
        icon={<ClipboardList size={17} strokeWidth={1.8} />}
      />
      <QueryBoundary
        query={reviews}
        error="Could not load your reviews."
        skeleton={<SkeletonText lines={3} className="p-5" />}
        isEmpty={(data) => data.length === 0}
        empty={
          <p className="px-5 py-8 text-sm text-muted">
            Nothing written yet. The first one is on the Progress screen.
          </p>
        }
      >
        {(data) => (
          <ul className="divide-y divide-hairline">
            {data.map((review) => (
              <li key={review._id} className="px-4 py-4 sm:px-5">
                <p className="text-xs font-semibold uppercase tracking-[0.08em] text-faint">
                  Week of {formatDayIST(review.week_start)}
                </p>
                <dl className="mt-2 grid gap-x-6 gap-y-2 sm:grid-cols-3">
                  <Prompt label="What slipped" value={review.what_slipped} />
                  <Prompt label="To replan" value={review.what_to_replan} />
                  <Prompt label="One change" value={review.one_change} />
                </dl>
                <p className="mt-3 text-xs tabular-nums text-muted">
                  {review.nodes_covered} covered · {review.nodes_revised} revised ·{' '}
                  {review.answers_written} answers
                  {review.avg_accuracy !== null &&
                    ` · ${Math.round(review.avg_accuracy * 100)}% accuracy`}
                </p>
              </li>
            ))}
          </ul>
        )}
      </QueryBoundary>
    </Card>
  )
}

function Prompt({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-faint">{label}</dt>
      <dd className="whitespace-pre-wrap text-sm text-ink">{value || '—'}</dd>
    </div>
  )
}

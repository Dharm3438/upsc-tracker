import { useEffect, useState } from 'react'
import { Filter, Inbox, ListChecks, Newspaper, Plus } from 'lucide-react'
import { useSearchParams } from 'react-router-dom'

import { formatMonth, type CaItem } from '@/api/ca'
import { tagLabel, type MistakeTag } from '@/api/mistakes'
import type { Subject } from '@/api/syllabus'
import { CaList, CaRows } from '@/components/ca/CaList'
import { CaSheet } from '@/components/ca/CaSheet'
import { MistakeList } from '@/components/mistakes/MistakeList'
import { TagBar } from '@/components/mistakes/TagBar'
import {
  Button,
  Card,
  CardHeader,
  Chip,
  ChipRow,
  PageHeader,
  SearchInput,
  SegmentedControl,
  StatTile,
} from '@/components/ui'
import { useCaInbox, useCaItems, useCaMonths } from '@/hooks/useCa'
import { useMistakes, useMistakeSummary } from '@/hooks/useMistakes'
import { useSubjects } from '@/hooks/useSyllabus'

const SEARCH_DEBOUNCE_MS = 250

type Section = 'mistakes' | 'ca'

/**
 * Notes holds current affairs and the mistake notebook. Which half opens is in
 * the URL, so the dashboard's inbox card can land straight on the items waiting
 * to be tagged.
 */
export function Notes() {
  const [params, setParams] = useSearchParams()
  const section: Section = params.get('tab') === 'ca' ? 'ca' : 'mistakes'
  const [adding, setAdding] = useState(false)
  const inbox = useCaInbox()

  return (
    <>
      <PageHeader
        title="Notes"
        subtitle="What went wrong, and what is worth quoting back at an examiner."
        actions={
          <>
            <SegmentedControl<Section>
              label="Notes section"
              value={section}
              onChange={(next) =>
                setParams(next === 'ca' ? { tab: 'ca' } : {}, { replace: true })
              }
              options={[
                {
                  value: 'mistakes',
                  label: 'Mistakes',
                  icon: <ListChecks size={15} strokeWidth={1.9} />,
                },
                {
                  value: 'ca',
                  label: 'Current affairs',
                  icon: <Newspaper size={15} strokeWidth={1.9} />,
                  count: inbox.data?.total,
                },
              ]}
            />
            {section === 'ca' && (
              <Button
                variant="primary"
                icon={<Plus size={15} strokeWidth={2.2} />}
                onClick={() => setAdding(true)}
              >
                Add one
              </Button>
            )}
          </>
        }
      />

      {section === 'mistakes' ? <Notebook /> : <CurrentAffairs adding={adding} onAdded={() => setAdding(false)} />}
    </>
  )
}

/** The filter rail. Sticky beside the list on a desktop; stacked above it on a
 *  phone, where sticky filters would eat a third of the screen. */
function Rail({ children }: { children: React.ReactNode }) {
  return (
    <div className="col-span-12 min-w-0 space-y-4 lg:col-span-4 lg:sticky lg:top-[calc(theme(spacing.topnav)+24px)] lg:self-start xl:col-span-3">
      {children}
    </div>
  )
}

function Notebook() {
  const [tag, setTag] = useState<MistakeTag | undefined>()
  const [subject, setSubject] = useState<Subject | undefined>()
  const allSubjects = useSubjects()
  const [search, setSearch] = useState('')
  const [debounced, setDebounced] = useState('')

  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(search.trim()), SEARCH_DEBOUNCE_MS)
    return () => window.clearTimeout(timer)
  }, [search])

  // The breakdown follows the subject filter but not the tag filter: filtering to
  // one tag and then reading a bar made only of that tag would say nothing.
  const summary = useMistakeSummary({ subject })
  const mistakes = useMistakes({ tag, subject, q: debounced || undefined })

  return (
    <>
      <div className="mb-4 grid grid-cols-2 gap-3 lg:mb-5 lg:grid-cols-4 lg:gap-5">
        <StatTile label="Logged" value={summary.data?.total ?? 0} loading={!summary.data} />
        <StatTile
          label="Still open"
          value={summary.data?.unresolved ?? 0}
          tone="accent"
          loading={!summary.data}
          progress={
            summary.data && summary.data.total > 0
              ? { value: summary.data.unresolved, max: summary.data.total }
              : undefined
          }
        />
        <StatTile
          label="Biggest pattern"
          loading={!summary.data}
          value={
            <span className="text-2xl">
              {summary.data?.by_tag.reduce(
                (top, row) => (row.count > top.count ? row : top),
                summary.data.by_tag[0] ?? { label: '—', count: 0 },
              ).label ?? '—'}
            </span>
          }
          sub="the one worth fixing first"
        />
        <StatTile
          label="Settled"
          value={(summary.data?.total ?? 0) - (summary.data?.unresolved ?? 0)}
          tone="success"
          loading={!summary.data}
        />
      </div>

      <div className="grid grid-cols-12 items-start gap-4 lg:gap-5">
        <Rail>
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder="Search questions and notes…"
          />
          <ChipRow className="lg:flex-wrap">
            <Chip selected={subject === undefined} onClick={() => setSubject(undefined)}>
              All subjects
            </Chip>
            {(allSubjects.data ?? []).map((option) => (
              <Chip
                key={option.subject}
                selected={subject === option.subject}
                onClick={() =>
                  setSubject(subject === option.subject ? undefined : option.subject)
                }
              >
                {option.label}
              </Chip>
            ))}
          </ChipRow>

          {summary.data && summary.data.total > 0 && (
            <Card>
              <CardHeader
                title="The pattern"
                subtitle="Tap a tag to filter the list."
                icon={<Filter size={17} strokeWidth={1.8} />}
              />
              <TagBar summary={summary.data} selected={tag} onSelect={setTag} />
            </Card>
          )}
        </Rail>

        <Card className="col-span-12 min-w-0 lg:col-span-8 xl:col-span-9">
          <CardHeader
            title="The notebook"
            subtitle={
              summary.data && summary.data.total > 0
                ? `${summary.data.unresolved} of ${summary.data.total} still open${
                    tag ? ` · showing ${tagLabel(tag).toLowerCase()}` : ''
                  }`
                : undefined
            }
            icon={<ListChecks size={17} strokeWidth={1.8} />}
          />
          <MistakeList
            query={mistakes}
            empty="Add them after your next test — the patterns are more useful than the score."
          />
        </Card>
      </div>
    </>
  )
}

/**
 * Two filters: by month for magazine revision, and by subject to pull everything
 * current before revising that subject. Untagged items sit above both in their own
 * card — they are not part of any month's revision until they are placed.
 */
function CurrentAffairs({ adding, onAdded }: { adding: boolean; onAdded: () => void }) {
  const [month, setMonth] = useState<string | undefined>()
  const [subject, setSubject] = useState<Subject | undefined>()
  const allSubjects = useSubjects()
  const [editing, setEditing] = useState<CaItem | null>(null)

  const inbox = useCaInbox()
  const months = useCaMonths()
  const items = useCaItems({ month, subject })

  const waiting = inbox.data?.total ?? 0

  return (
    <>
      <div className="grid grid-cols-12 items-start gap-4 lg:gap-5">
        <Rail>
          <ChipRow className="lg:flex-wrap">
            <Chip selected={month === undefined} onClick={() => setMonth(undefined)}>
              All months
            </Chip>
            {(months.data ?? []).map((option) => (
              <Chip
                key={option.month}
                selected={month === option.month}
                count={option.count}
                onClick={() => setMonth(month === option.month ? undefined : option.month)}
              >
                {formatMonth(option.month)}
              </Chip>
            ))}
          </ChipRow>

          <ChipRow className="lg:flex-wrap">
            <Chip selected={subject === undefined} onClick={() => setSubject(undefined)}>
              All subjects
            </Chip>
            {(allSubjects.data ?? []).map((option) => (
              <Chip
                key={option.subject}
                selected={subject === option.subject}
                onClick={() =>
                  setSubject(subject === option.subject ? undefined : option.subject)
                }
              >
                {option.label}
              </Chip>
            ))}
          </ChipRow>
        </Rail>

        <div className="col-span-12 min-w-0 space-y-4 lg:col-span-8 lg:space-y-5 xl:col-span-9">
          {waiting > 0 && (
            <Card className="border-accent-ring">
              <CardHeader
                className="bg-accent-soft"
                title="Inbox"
                count={waiting}
                subtitle="Tag each one to the topic it belongs under and it joins that topic's timeline."
                icon={<Inbox size={17} strokeWidth={1.8} />}
              />
              <CaRows items={inbox.data?.items ?? []} onEdit={setEditing} />
            </Card>
          )}

          <Card>
            <CardHeader
              title={month ? formatMonth(month) : 'Everything current'}
              subtitle={subject ? `Filtered to ${subject}` : 'Newest first, grouped by the day.'}
              icon={<Newspaper size={17} strokeWidth={1.8} />}
            />
            <CaList
              query={items}
              onEdit={setEditing}
              empty={
                waiting > 0
                  ? 'Nothing tagged here yet. Start with the inbox above.'
                  : 'No current affairs here yet. Two lines a day is enough.'
              }
            />
          </Card>
        </div>
      </div>

      {(adding || editing) && (
        <CaSheet
          existing={editing ?? undefined}
          onClose={() => {
            onAdded()
            setEditing(null)
          }}
        />
      )}
    </>
  )
}

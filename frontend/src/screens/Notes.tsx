import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'

import { formatMonth, type CaItem } from '@/api/ca'
import { tagLabel, type MistakeTag } from '@/api/mistakes'
import type { Paper } from '@/api/syllabus'
import { CaList, CaRows } from '@/components/ca/CaList'
import { CaSheet } from '@/components/ca/CaSheet'
import { MistakeList } from '@/components/mistakes/MistakeList'
import { TagBar } from '@/components/mistakes/TagBar'
import { Header } from '@/components/shell/Header'
import { useCaInbox, useCaItems, useCaMonths } from '@/hooks/useCa'
import { useMistakes, useMistakeSummary } from '@/hooks/useMistakes'

const SEARCH_DEBOUNCE_MS = 250

type Section = 'mistakes' | 'ca'

/**
 * Notes holds current affairs and the mistake notebook. Which half opens is in
 * the URL, so the Today screen's inbox row can land straight on the items
 * waiting to be tagged.
 */
export function Notes() {
  const [params, setParams] = useSearchParams()
  const section: Section = params.get('tab') === 'ca' ? 'ca' : 'mistakes'

  const select = (next: Section) => {
    setParams(next === 'ca' ? { tab: 'ca' } : {}, { replace: true })
  }

  return (
    <>
      <Header title="Notes" />
      <div className="flex gap-2 px-4 pb-3">
        <Segment
          selected={section === 'mistakes'}
          onClick={() => select('mistakes')}
          label="Mistakes"
        />
        <Segment
          selected={section === 'ca'}
          onClick={() => select('ca')}
          label="Current affairs"
        />
      </div>

      {section === 'mistakes' ? <Notebook /> : <CurrentAffairs />}
    </>
  )
}

const PAPERS: Paper[] = ['GS1', 'GS2', 'GS3', 'GS4', 'CSAT', 'ANTHRO1', 'ANTHRO2']

/**
 * Two filters, as the plan asks: by month for magazine revision, and by paper
 * to pull everything current before revising that paper. Untagged items float
 * above both under an Inbox header — they are not part of any month's revision
 * until they are placed.
 */
function CurrentAffairs() {
  const [month, setMonth] = useState<string | undefined>()
  const [paper, setPaper] = useState<Paper | undefined>()
  const [editing, setEditing] = useState<CaItem | null>(null)
  const [adding, setAdding] = useState(false)

  const inbox = useCaInbox()
  const months = useCaMonths()
  const items = useCaItems({ month, paper })

  const waiting = inbox.data?.total ?? 0

  return (
    <>
      <div className="px-4 pb-3">
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="h-tap w-full rounded border border-signal text-sm font-medium text-signal"
        >
          Add a current affair
        </button>
      </div>

      {waiting > 0 && (
        <section className="mb-6">
          <div className="flex items-baseline justify-between px-4 pb-2">
            <h2 className="text-xs uppercase tracking-wide text-slate">Inbox</h2>
            <span className="text-sm tabular-nums text-slate">{waiting}</span>
          </div>
          <div className="border-y border-line bg-surface">
            <CaRows items={inbox.data?.items ?? []} onEdit={setEditing} />
          </div>
          <p className="px-4 pt-2 text-xs text-slate">
            Tag each one to the topic it belongs under, and it joins that topic's
            timeline.
          </p>
        </section>
      )}

      <div className="flex gap-2 overflow-x-auto px-4 pb-3">
        <Chip selected={month === undefined} onClick={() => setMonth(undefined)}>
          All months
        </Chip>
        {(months.data ?? []).map((option) => (
          <Chip
            key={option.month}
            selected={month === option.month}
            onClick={() => setMonth(month === option.month ? undefined : option.month)}
          >
            {formatMonth(option.month)}
          </Chip>
        ))}
      </div>

      <div className="flex gap-2 overflow-x-auto px-4 pb-3">
        <Chip selected={paper === undefined} onClick={() => setPaper(undefined)}>
          All papers
        </Chip>
        {PAPERS.map((option) => (
          <Chip
            key={option}
            selected={paper === option}
            onClick={() => setPaper(paper === option ? undefined : option)}
          >
            {option}
          </Chip>
        ))}
      </div>

      <div className="border-y border-line bg-surface">
        <CaList
          query={items}
          onEdit={setEditing}
          empty={
            waiting > 0
              ? 'Nothing tagged here yet. Start with the inbox above.'
              : 'No current affairs here yet. Two lines a day is enough.'
          }
        />
      </div>

      {(adding || editing) && (
        <CaSheet
          existing={editing ?? undefined}
          onClose={() => {
            setAdding(false)
            setEditing(null)
          }}
        />
      )}
    </>
  )
}

function Notebook() {
  const [tag, setTag] = useState<MistakeTag | undefined>()
  const [paper, setPaper] = useState<Paper | undefined>()
  const [search, setSearch] = useState('')
  const [debounced, setDebounced] = useState('')

  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(search.trim()), SEARCH_DEBOUNCE_MS)
    return () => window.clearTimeout(timer)
  }, [search])

  // The breakdown follows the paper filter but not the tag filter: filtering to
  // one tag and then reading a bar made only of that tag would say nothing.
  const summary = useMistakeSummary({ paper })
  const mistakes = useMistakes({ tag, paper, q: debounced || undefined })

  return (
    <>
      <div className="px-4 pb-3">
        <input
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search questions and notes…"
          className="h-tap w-full rounded border border-line bg-surface px-3 text-sm focus:border-signal"
        />
      </div>

      <div className="flex gap-2 overflow-x-auto px-4 pb-3">
        <Chip selected={paper === undefined} onClick={() => setPaper(undefined)}>
          All papers
        </Chip>
        {PAPERS.map((option) => (
          <Chip
            key={option}
            selected={paper === option}
            onClick={() => setPaper(paper === option ? undefined : option)}
          >
            {option}
          </Chip>
        ))}
      </div>

      {summary.data && (
        <TagBar summary={summary.data} selected={tag} onSelect={setTag} />
      )}

      {summary.data && summary.data.total > 0 && (
        <p className="px-4 pb-2 text-xs text-slate">
          {summary.data.unresolved} of {summary.data.total} still open
          {tag ? ` · showing ${tagLabel(tag).toLowerCase()}` : ''}
        </p>
      )}

      <div className="border-y border-line bg-surface">
        <MistakeList
          query={mistakes}
          empty="No mistakes logged yet. Add them after your next test — the patterns are more useful than the score."
        />
      </div>
    </>
  )
}

function Segment({
  selected,
  onClick,
  label,
}: {
  selected: boolean
  onClick: () => void
  label: string
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={[
        'h-9 flex-1 rounded-full border text-sm',
        selected ? 'border-signal bg-signal text-surface' : 'border-line text-slate',
      ].join(' ')}
    >
      {label}
    </button>
  )
}

function Chip({
  selected,
  onClick,
  children,
}: {
  selected: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={[
        'h-9 shrink-0 whitespace-nowrap rounded-full border px-3 text-sm',
        selected ? 'border-signal bg-signal text-surface' : 'border-line bg-surface text-slate',
      ].join(' ')}
    >
      {children}
    </button>
  )
}

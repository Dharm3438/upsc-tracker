import { useEffect, useState } from 'react'

import { tagLabel, type MistakeTag } from '@/api/mistakes'
import type { Paper } from '@/api/syllabus'
import { EmptyState } from '@/components/EmptyState'
import { MistakeList } from '@/components/mistakes/MistakeList'
import { TagBar } from '@/components/mistakes/TagBar'
import { Header } from '@/components/shell/Header'
import { useMistakes, useMistakeSummary } from '@/hooks/useMistakes'

const SEARCH_DEBOUNCE_MS = 250

/**
 * Notes holds current affairs and the mistake notebook. Current affairs lands
 * in phase 6; the notebook is here now, and it is the half she will open more.
 */
export function Notes() {
  const [section, setSection] = useState<'mistakes' | 'ca'>('mistakes')

  return (
    <>
      <Header title="Notes" />
      <div className="flex gap-2 px-4 pb-3">
        <Segment
          selected={section === 'mistakes'}
          onClick={() => setSection('mistakes')}
          label="Mistakes"
        />
        <Segment
          selected={section === 'ca'}
          onClick={() => setSection('ca')}
          label="Current affairs"
        />
      </div>

      {section === 'mistakes' ? (
        <Notebook />
      ) : (
        <EmptyState>Current affairs arrives in phase 6.</EmptyState>
      )}
    </>
  )
}

const PAPERS: Paper[] = ['GS1', 'GS2', 'GS3', 'GS4', 'CSAT', 'ANTHRO1', 'ANTHRO2']

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
        'h-9 shrink-0 rounded-full border px-3 text-sm',
        selected ? 'border-signal bg-signal text-surface' : 'border-line bg-surface text-slate',
      ].join(' ')}
    >
      {children}
    </button>
  )
}

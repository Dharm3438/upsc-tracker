import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'

import { searchNodes } from '@/api/syllabus'
import { useRecentNodes } from '@/hooks/useLogs'

export type PickedNode = { id: string; title: string; path: string }

/** Logs attach to topics and leaves; a whole section is too coarse to study. */
const MIN_LEVEL = 2
const SEARCH_DEBOUNCE_MS = 250

/**
 * Choosing the topic is the slow half of logging, so the recent row comes
 * first: on most days the topic is already on screen and search never opens.
 */
export function NodePicker({
  value,
  onChange,
}: {
  value: PickedNode | null
  onChange: (node: PickedNode) => void
}) {
  const [query, setQuery] = useState('')
  const [debounced, setDebounced] = useState('')
  const recent = useRecentNodes()

  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(query.trim()), SEARCH_DEBOUNCE_MS)
    return () => window.clearTimeout(timer)
  }, [query])

  const results = useQuery({
    queryKey: ['node-search', debounced],
    queryFn: () => searchNodes(debounced),
    enabled: debounced.length >= 2,
  })

  const matches = (results.data ?? []).filter((node) => node.level >= MIN_LEVEL)

  return (
    <div>
      {recent.data && recent.data.length > 0 && (
        <div className="-mx-4 mb-3 flex gap-2 overflow-x-auto px-4 pb-1">
          {recent.data.map((node) => (
            <Chip
              key={node.node_id}
              selected={value?.id === node.node_id}
              onClick={() =>
                onChange({ id: node.node_id, title: node.title, path: node.path })
              }
            >
              {node.title}
            </Chip>
          ))}
        </div>
      )}

      <input
        type="search"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder={recent.data?.length ? 'Or search for a topic…' : 'Search for a topic…'}
        className="h-tap w-full rounded border border-line bg-surface px-3 text-sm focus:border-signal"
      />

      {debounced.length >= 2 && (
        <ul className="mt-2 max-h-48 overflow-y-auto rounded border border-line">
          {matches.length === 0 && (
            <li className="px-3 py-3 text-sm text-slate">
              {results.isFetching ? 'Searching…' : 'Nothing matches that.'}
            </li>
          )}
          {matches.map((node) => (
            <li key={node._id} className="border-b border-line last:border-0">
              <button
                type="button"
                onClick={() => {
                  onChange({ id: node._id, title: node.title, path: node.path })
                  setQuery('')
                }}
                className="w-full px-3 py-2 text-left"
              >
                <span className="block truncate text-sm">{node.title}</span>
                <span className="block truncate text-xs text-slate">
                  {node.path.split('/').slice(0, -1).join(' › ')}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {value && (
        <p className="mt-2 truncate text-xs text-slate">
          Logging against <span className="text-ink">{value.title}</span>
        </p>
      )}
    </div>
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
      onClick={onClick}
      aria-pressed={selected}
      className={[
        'h-9 shrink-0 whitespace-nowrap rounded-full border px-3 text-sm',
        selected ? 'border-signal bg-signal text-surface' : 'border-line text-slate',
      ].join(' ')}
    >
      {children}
    </button>
  )
}

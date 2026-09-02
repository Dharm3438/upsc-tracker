import { useState } from 'react'

import type { DueNode } from '@/api/review'

/** Enough to start on without the section filling the screen; the rest is one
 *  tap away (plan §8.1). */
const INITIAL_ROWS = 3

/** Past two weeks late, a row earns the one warm tone in the palette. */
const ATTENTION_DAYS = 14

export function DueList({
  items,
  onGrade,
}: {
  items: DueNode[]
  onGrade: (node: DueNode) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const shown = expanded ? items : items.slice(0, INITIAL_ROWS)
  const hidden = items.length - shown.length

  return (
    <>
      <ul>
        {shown.map((node) => (
          <li key={node.node_id} className="border-b border-line last:border-0">
            <button
              type="button"
              onClick={() => onGrade(node)}
              className="flex min-h-tap w-full items-center gap-3 px-4 py-2 text-left"
            >
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm">{node.title}</span>
                <span className="block truncate text-xs text-slate">
                  {node.path.split('/')[0]} · {node.path.split('/').slice(1, -1).join(' › ')}
                </span>
              </span>
              <span
                className={`shrink-0 text-xs tabular-nums ${
                  node.days_overdue > ATTENTION_DAYS ? 'text-overdue' : 'text-slate'
                }`}
              >
                {state(node)}
              </span>
              <span aria-hidden className="shrink-0 text-slate">
                ›
              </span>
            </button>
          </li>
        ))}
      </ul>

      {hidden > 0 && (
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="min-h-tap w-full border-t border-line px-4 text-left text-sm text-signal"
        >
          Show {hidden} more
        </button>
      )}
    </>
  )
}

/** The right-hand column: how late it is if it is late, otherwise how it went
 *  last time. Lateness is the more urgent of the two, so it wins the space. */
function state(node: DueNode): string {
  if (node.days_overdue > 0) return `${node.days_overdue}d late`
  if (node.last_confidence) return `last ${node.last_confidence}/5`
  return 'new'
}

import { useRef } from 'react'
import { useNavigate } from 'react-router-dom'

import type { TreeNode } from '@/api/syllabus'
import { daysUntil } from '@/lib/date'

const LONG_PRESS_MS = 450

/**
 * One line per node. The fill bar carries the state, so the row stays scannable
 * one-handed. Depth of fill, not traffic lights: pale is weak, saturated is strong.
 *
 * The caret expands; the title opens the node. A long press anywhere opens the
 * edit menu.
 */
export function NodeRow({
  node,
  expanded,
  onToggle,
  onLongPress,
}: {
  node: TreeNode
  expanded: boolean
  onToggle: () => void
  onLongPress: () => void
}) {
  const navigate = useNavigate()
  const hasChildren = node.children.length > 0
  const indent = ['pl-4', 'pl-8', 'pl-12'][node.level - 1]

  const timer = useRef<number>()
  const fired = useRef(false)

  function startPress() {
    fired.current = false
    timer.current = window.setTimeout(() => {
      fired.current = true
      onLongPress()
    }, LONG_PRESS_MS)
  }

  function endPress() {
    window.clearTimeout(timer.current)
  }

  return (
    <li
      className={`flex items-center border-b border-line ${indent}`}
      onPointerDown={startPress}
      onPointerUp={endPress}
      onPointerLeave={endPress}
      onContextMenu={(event) => {
        // Long press on touch also raises a context menu; suppress it so the
        // sheet is the only thing that opens.
        event.preventDefault()
        if (!fired.current) onLongPress()
      }}
    >
      <button
        type="button"
        onClick={hasChildren ? onToggle : undefined}
        aria-expanded={hasChildren ? expanded : undefined}
        aria-label={hasChildren ? `${expanded ? 'Collapse' : 'Expand'} ${node.title}` : undefined}
        disabled={!hasChildren}
        className="flex h-tap w-6 shrink-0 items-center text-slate"
      >
        {hasChildren ? (expanded ? '▾' : '▸') : ''}
      </button>

      <button
        type="button"
        onClick={() => {
          if (!fired.current) navigate(`/syllabus/node/${node._id}`)
        }}
        className="flex min-h-tap min-w-0 flex-1 items-center gap-3 pr-4 text-left"
      >
        <span className="min-w-0 flex-1 truncate text-sm">{node.title}</span>
        {node.needs_diagram && (
          <span className="text-xs text-slate" title="Diagram carries marks here">
            ⚑
          </span>
        )}
        <span className="w-20 shrink-0">
          <Fill node={node} />
        </span>
      </button>
    </li>
  )
}

/** Overdue past this many days earns the one warm tone in the palette. */
const BADLY_OVERDUE_DAYS = 14

function Fill({ node }: { node: TreeNode }) {
  // A parent carries the share of its leaves that have been started; a leaf
  // carries its own depth of fill. Same column, two honest readings of it.
  if (node.children.length > 0) {
    if (node.leaf_started === 0) {
      return <span className="block text-right text-xs text-slate">—</span>
    }
    const percent = Math.round((node.leaf_started / node.leaf_count) * 100)
    return <span className="block text-right text-xs text-slate">{percent}%</span>
  }

  if (node.read_count === 0 && node.revise_count === 0) {
    return <span className="block text-right text-xs text-slate">not started</span>
  }

  // Confidence is the truest signal once it exists; before the first grading,
  // having read it at all is worth one step of fill.
  const depth = node.confidence ?? 1
  const overdueBy = node.next_due ? -daysUntil(node.next_due) : 0
  const overdue = overdueBy > BADLY_OVERDUE_DAYS

  return (
    <span className="flex items-center justify-end gap-2">
      <span className="h-1.5 w-10 shrink-0 overflow-hidden rounded-full bg-paper">
        <span
          className={`block h-full ${overdue ? 'bg-overdue' : DEPTH[depth]}`}
          style={{ width: `${(depth / 5) * 100}%` }}
        />
      </span>
      <span className={`text-xs ${overdue ? 'text-overdue' : 'text-slate'}`}>
        {node.revise_count > 0 ? `${node.revise_count}×` : 'read'}
      </span>
    </span>
  )
}

const DEPTH: Record<number, string> = {
  1: 'bg-depth-1',
  2: 'bg-depth-2',
  3: 'bg-depth-3',
  4: 'bg-depth-4',
  5: 'bg-depth-5',
}

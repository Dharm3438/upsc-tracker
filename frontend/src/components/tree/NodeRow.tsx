import { useRef } from 'react'
import { useNavigate } from 'react-router-dom'

import type { TreeNode } from '@/api/syllabus'

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

function Fill({ node }: { node: TreeNode }) {
  // Until logging lands (phase 2) every node reads as not started, which is honest.
  const touched = node.read_count > 0 || node.revise_count > 0
  const depth = Math.min(5, node.revise_count + (node.read_count > 0 ? 1 : 0))

  if (!touched) {
    return <span className="block text-right text-xs text-slate">not started</span>
  }

  return (
    <span className="flex items-center justify-end gap-2">
      <span className="h-1.5 w-10 overflow-hidden rounded-full bg-depth-1">
        <span className="block h-full bg-depth-4" style={{ width: `${(depth / 5) * 100}%` }} />
      </span>
      <span className="text-xs text-slate">{node.revise_count}×</span>
    </span>
  )
}

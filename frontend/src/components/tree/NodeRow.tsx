import { useRef } from 'react'
import { ChevronRight, MoreHorizontal, Shapes } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

import type { PyqWeight, TreeNode } from '@/api/syllabus'
import { Badge } from '@/components/ui/Badge'
import { cn } from '@/lib/cn'
import { daysUntil } from '@/lib/date'
import { ATTENTION_DAYS, DEPTH_BG } from '@/lib/tokens'

const LONG_PRESS_MS = 450

// Only "high" earns a badge. Medium is the seed's default for every lecture and
// every chapter without a priority band, so badging it would mark most of the
// syllabus and single out nothing. The exact weight is still on the topic page.
const WEIGHT: Partial<Record<PyqWeight, { label: string; tone: 'accent' | 'neutral' }>> = {
  high: { label: 'High PYQ', tone: 'accent' },
}

/**
 * One line per node. The fill bar carries the state, so the row stays scannable
 * one-handed. Depth of fill, not traffic lights: pale is weak, saturated is
 * strong.
 *
 * The caret expands; the title opens the node. A long press anywhere opens the
 * edit menu on touch — and because a long press is undiscoverable with a mouse,
 * a kebab appears on hover from `lg` up.
 */
export function NodeRow({
  node,
  expanded,
  selected,
  onToggle,
  onLongPress,
}: {
  node: TreeNode
  expanded: boolean
  selected?: boolean
  onToggle: () => void
  onLongPress: () => void
}) {
  const navigate = useNavigate()
  const hasChildren = node.children.length > 0

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

  // A section's PYQ weight is inherited noise; only a leaf's is a real signal.
  const weight = hasChildren ? undefined : WEIGHT[node.pyq_weight]

  return (
    <li
      className={cn(
        'group/row relative flex items-center border-b border-hairline transition-colors last:border-0',
        selected ? 'bg-accent-soft' : 'hover:bg-canvas',
      )}
      style={{ paddingLeft: `${(node.level - 1) * 16}px` }}
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
      {/* Guide rules, so a level-3 leaf still reads as belonging to something. */}
      {node.level > 1 && (
        <span
          aria-hidden
          className="absolute inset-y-0 w-px bg-hairline"
          style={{ left: `${(node.level - 1) * 16 - 8}px` }}
        />
      )}

      <button
        type="button"
        onClick={hasChildren ? onToggle : undefined}
        aria-expanded={hasChildren ? expanded : undefined}
        aria-label={hasChildren ? `${expanded ? 'Collapse' : 'Expand'} ${node.title}` : undefined}
        disabled={!hasChildren}
        className="flex h-tap w-7 shrink-0 items-center justify-center text-faint disabled:opacity-0"
      >
        <ChevronRight
          size={15}
          strokeWidth={2}
          className={cn('transition-transform', expanded && 'rotate-90')}
        />
      </button>

      <button
        type="button"
        onClick={() => {
          if (!fired.current) navigate(`/syllabus/node/${node._id}`)
        }}
        className="flex min-h-tap min-w-0 flex-1 items-center gap-2 py-1.5 pr-3 text-left"
      >
        <span
          className={cn(
            'min-w-0 flex-1 truncate text-sm',
            node.level === 1 ? 'font-medium text-ink' : 'text-ink',
          )}
        >
          {node.title}
        </span>

        {node.needs_diagram && (
          <span className="shrink-0 text-faint" title="Diagram carries marks here">
            <Shapes size={14} strokeWidth={1.8} />
          </span>
        )}

        {weight && (
          <Badge tone={weight.tone} size="sm" className="hidden shrink-0 xl:inline-flex">
            {weight.label}
          </Badge>
        )}

        <span className="w-24 shrink-0 sm:w-28">
          <Fill node={node} />
        </span>
      </button>

      <button
        type="button"
        onClick={onLongPress}
        aria-label={`Edit ${node.title}`}
        className="mr-1 hidden shrink-0 rounded-md p-1.5 text-faint opacity-0 transition-opacity hover:bg-hairline/70 hover:text-ink focus-visible:opacity-100 group-hover/row:opacity-100 lg:block"
      >
        <MoreHorizontal size={15} strokeWidth={2} />
      </button>
    </li>
  )
}

function Fill({ node }: { node: TreeNode }) {
  // A parent carries the share of its leaves that have been started; a leaf
  // carries its own depth of fill. Same column, two honest readings of it.
  if (node.children.length > 0) {
    if (node.leaf_started === 0) {
      return <span className="block text-right text-xs text-faint">—</span>
    }
    const percent = Math.round((node.leaf_started / node.leaf_count) * 100)
    return (
      <span className="flex items-center justify-end gap-2">
        <span className="hidden h-1.5 w-12 overflow-hidden rounded-full bg-hairline sm:block">
          <span className="block h-full rounded-full bg-depth-3" style={{ width: `${percent}%` }} />
        </span>
        <span className="text-xs tabular-nums text-muted">{percent}%</span>
      </span>
    )
  }

  if (node.read_count === 0 && node.revise_count === 0) {
    return <span className="block text-right text-xs text-faint">not started</span>
  }

  // Confidence is the truest signal once it exists; before the first grading,
  // having read it at all is worth one step of fill.
  const depth = node.confidence ?? 1
  const overdueBy = node.next_due ? -daysUntil(node.next_due) : 0
  const late = overdueBy > ATTENTION_DAYS

  return (
    <span className="flex items-center justify-end gap-2">
      <span className="h-1.5 w-12 shrink-0 overflow-hidden rounded-full bg-hairline">
        <span
          className={cn('block h-full rounded-full', late ? 'bg-danger' : DEPTH_BG[depth])}
          style={{ width: `${(depth / 5) * 100}%` }}
        />
      </span>
      <span className={cn('w-8 text-right text-xs tabular-nums', late ? 'text-danger' : 'text-muted')}>
        {node.revise_count > 0 ? `${node.revise_count}×` : 'read'}
      </span>
    </span>
  )
}

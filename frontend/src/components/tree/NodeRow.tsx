import type { TreeNode } from '@/api/syllabus'

/**
 * One line per node. The fill bar carries the state, so the row stays scannable
 * one-handed. Depth of fill, not traffic lights: pale is weak, saturated is strong.
 */
export function NodeRow({
  node,
  expanded,
  onToggle,
}: {
  node: TreeNode
  expanded: boolean
  onToggle: () => void
}) {
  const hasChildren = node.children.length > 0
  const indent = ['pl-4', 'pl-8', 'pl-12'][node.level - 1]

  const body = (
    <div className="flex min-h-tap w-full items-center gap-3 pr-4 text-left">
      {/* Leaves keep the same indent as their siblings but no caret to read. */}
      <span className="w-3 shrink-0 text-slate" aria-hidden={!hasChildren}>
        {hasChildren ? (expanded ? '▾' : '▸') : ''}
      </span>
      <span className="min-w-0 flex-1 truncate text-sm">{node.title}</span>
      {node.needs_diagram && (
        <span className="text-xs text-slate" title="Diagram carries marks here">
          ⚑
        </span>
      )}
      <span className="w-20 shrink-0">
        <Fill node={node} />
      </span>
    </div>
  )

  return (
    <li className={`border-b border-line ${indent}`}>
      {hasChildren ? (
        <button type="button" onClick={onToggle} aria-expanded={expanded} className="w-full">
          {body}
        </button>
      ) : (
        body
      )}
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
        <span
          className="block h-full bg-depth-4"
          style={{ width: `${(depth / 5) * 100}%` }}
        />
      </span>
      <span className="text-xs text-slate">{node.revise_count}×</span>
    </span>
  )
}

import { useState } from 'react'

import type { TreeNode } from '@/api/syllabus'
import { NodeRow } from './NodeRow'

export function SyllabusTree({ nodes }: { nodes: TreeNode[] }) {
  // Sections start open, topics closed: the whole paper on one screen would be
  // a wall, and a fully collapsed tree hides that anything exists.
  const [collapsed, setCollapsed] = useState<Set<string>>(
    () => new Set(nodes.flatMap((n) => n.children.map((c) => c._id))),
  )

  function toggle(id: string) {
    setCollapsed((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function render(items: TreeNode[]): React.ReactNode {
    return items.map((node) => {
      const expanded = !collapsed.has(node._id)
      return (
        <li key={node._id} className="contents">
          <ul className="contents">
            <NodeRow node={node} expanded={expanded} onToggle={() => toggle(node._id)} />
            {expanded && node.children.length > 0 && render(node.children)}
          </ul>
        </li>
      )
    })
  }

  return <ul className="bg-surface">{render(nodes)}</ul>
}

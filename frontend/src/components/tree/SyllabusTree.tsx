import { useState } from 'react'

import type { TreeNode } from '@/api/syllabus'
import { NodeRow } from './NodeRow'

export function SyllabusTree({
  nodes,
  selectedId,
  onLongPress,
}: {
  nodes: TreeNode[]
  selectedId?: string
  onLongPress: (node: TreeNode) => void
}) {
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
    return items.flatMap((node) => {
      const expanded = !collapsed.has(node._id)
      return [
        <NodeRow
          key={node._id}
          node={node}
          expanded={expanded}
          selected={node._id === selectedId}
          onToggle={() => toggle(node._id)}
          onLongPress={() => onLongPress(node)}
        />,
        ...(expanded ? [render(node.children)] : []),
      ]
    })
  }

  return <ul>{render(nodes)}</ul>
}

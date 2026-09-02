import { useMemo, useState } from 'react'

import type { Paper, TreeNode } from '@/api/syllabus'
import { EmptyState } from '@/components/EmptyState'
import { PaperChips } from '@/components/PaperChips'
import { Header } from '@/components/shell/Header'
import { NodeActions } from '@/components/tree/NodeActions'
import { SyllabusTree } from '@/components/tree/SyllabusTree'
import { usePapers, useTree } from '@/hooks/useSyllabus'

export function Syllabus() {
  const [paper, setPaper] = useState<Paper>('GS1')
  const [acting, setActing] = useState<TreeNode | null>(null)
  const papers = usePapers()
  const tree = useTree(paper)

  const candidates = useMemo(
    () => (acting && tree.data ? moveTargets(tree.data, acting) : []),
    [acting, tree.data],
  )

  return (
    <>
      <Header title="Syllabus" />
      {papers.data && <PaperChips papers={papers.data} selected={paper} onSelect={setPaper} />}

      <TreeBody query={tree} onLongPress={setActing} />

      {acting && (
        <NodeActions node={acting} candidates={candidates} onClose={() => setActing(null)} />
      )}
    </>
  )
}

function TreeBody({
  query,
  onLongPress,
}: {
  query: ReturnType<typeof useTree>
  onLongPress: (node: TreeNode) => void
}) {
  if (query.isError) return <EmptyState>Could not load the syllabus.</EmptyState>
  if (!query.data) return <EmptyState>Loading…</EmptyState>
  if (query.data.length === 0) {
    return <EmptyState>Nothing seeded for this paper yet. Run the seed script.</EmptyState>
  }
  return <SyllabusTree nodes={query.data} onLongPress={onLongPress} />
}

/**
 * Somewhere `moving` could legally go: not itself, not inside its own subtree,
 * and not so deep that the subtree would spill past level 3. The server checks
 * all of this too; offering impossible options would just invite an error.
 */
function moveTargets(tree: TreeNode[], moving: TreeNode): TreeNode[] {
  const banned = new Set<string>([moving._id])
  const collectSubtree = (node: TreeNode) => {
    banned.add(node._id)
    node.children.forEach(collectSubtree)
  }
  collectSubtree(moving)

  const depth = subtreeDepth(moving)
  const out: TreeNode[] = []
  const walk = (nodes: TreeNode[]) => {
    for (const node of nodes) {
      if (!banned.has(node._id) && node.level + depth < 3) out.push(node)
      walk(node.children)
    }
  }
  walk(tree)
  return out
}

function subtreeDepth(node: TreeNode): number {
  if (node.children.length === 0) return 0
  return 1 + Math.max(...node.children.map(subtreeDepth))
}

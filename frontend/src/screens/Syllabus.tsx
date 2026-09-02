import { useState } from 'react'

import type { Paper } from '@/api/syllabus'
import { EmptyState } from '@/components/EmptyState'
import { PaperChips } from '@/components/PaperChips'
import { Header } from '@/components/shell/Header'
import { SyllabusTree } from '@/components/tree/SyllabusTree'
import { usePapers, useTree } from '@/hooks/useSyllabus'

export function Syllabus() {
  const [paper, setPaper] = useState<Paper>('GS1')
  const papers = usePapers()
  const tree = useTree(paper)

  return (
    <>
      <Header title="Syllabus" />
      {papers.data && <PaperChips papers={papers.data} selected={paper} onSelect={setPaper} />}

      <TreeBody query={tree} />
    </>
  )
}

function TreeBody({ query }: { query: ReturnType<typeof useTree> }) {
  if (query.isError) return <EmptyState>Could not load the syllabus.</EmptyState>
  if (!query.data) return <EmptyState>Loading…</EmptyState>
  if (query.data.length === 0) {
    return <EmptyState>Nothing seeded for this paper yet. Run the seed script.</EmptyState>
  }
  return <SyllabusTree nodes={query.data} />
}

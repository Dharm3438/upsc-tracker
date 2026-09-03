import type { Paper, PaperSummary } from '@/api/syllabus'
import { Chip, ChipRow } from '@/components/ui'

export function PaperChips({
  papers,
  selected,
  onSelect,
  showCounts = false,
}: {
  papers: PaperSummary[]
  selected: Paper
  onSelect: (paper: Paper) => void
  showCounts?: boolean
}) {
  return (
    <ChipRow>
      {papers.map((paper) => (
        <Chip
          key={paper.paper}
          selected={paper.paper === selected}
          onClick={() => onSelect(paper.paper)}
          count={showCounts ? paper.leaves : undefined}
        >
          {paper.label}
        </Chip>
      ))}
    </ChipRow>
  )
}

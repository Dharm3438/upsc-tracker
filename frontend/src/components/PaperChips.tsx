import type { Paper, PaperSummary } from '@/api/syllabus'

export function PaperChips({
  papers,
  selected,
  onSelect,
}: {
  papers: PaperSummary[]
  selected: Paper
  onSelect: (paper: Paper) => void
}) {
  return (
    <div className="flex gap-2 overflow-x-auto px-4 pb-3 pt-1">
      {papers.map((paper) => (
        <button
          key={paper.paper}
          type="button"
          onClick={() => onSelect(paper.paper)}
          aria-pressed={paper.paper === selected}
          className={[
            'shrink-0 rounded-full border px-3 py-1.5 text-sm',
            paper.paper === selected
              ? 'border-signal bg-signal text-white'
              : 'border-line bg-surface text-slate',
          ].join(' ')}
        >
          {paper.label}
        </button>
      ))}
    </div>
  )
}

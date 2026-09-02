import type { Coverage as CoverageData, PaperCoverage } from '@/api/progress'

/**
 * Three bars per paper: read once, revised twice, practised. They are nested
 * rather than stacked — every topic revised has been read, and every topic
 * practised has usually been read too — so the bars sit one under another at
 * the same width and the shortfall between them is the thing to see.
 *
 * Depth of fill carries the meaning: the deeper the bar, the further through
 * that topic she is.
 */
export function Coverage({ data }: { data: CoverageData }) {
  return (
    <div className="bg-surface">
      {data.papers.map((paper) => (
        <PaperRow key={paper.paper} row={paper} />
      ))}
      {data.totals && data.papers.length > 1 && (
        <PaperRow row={data.totals} muted />
      )}
    </div>
  )
}

function PaperRow({ row, muted = false }: { row: PaperCoverage; muted?: boolean }) {
  return (
    <div className="border-b border-line px-4 py-3 last:border-b-0">
      <div className="flex items-baseline justify-between pb-2">
        <h3 className={`text-sm ${muted ? 'text-slate' : 'font-medium'}`}>{row.label}</h3>
        <span className="text-xs tabular-nums text-slate">{row.leaves} topics</span>
      </div>
      <Bar label="Read" value={row.read} total={row.leaves} depth="bg-depth-2" />
      <Bar label="Revised twice" value={row.revised} total={row.leaves} depth="bg-depth-4" />
      <Bar label="Practised" value={row.tested} total={row.leaves} depth="bg-depth-5" />
    </div>
  )
}

function Bar({
  label,
  value,
  total,
  depth,
}: {
  label: string
  value: number
  total: number
  depth: string
}) {
  const share = total ? value / total : 0
  return (
    <div className="flex items-center gap-3 py-0.5">
      <span className="w-24 shrink-0 text-xs text-slate">{label}</span>
      <div className="h-2 flex-1 overflow-hidden rounded-sm bg-depth-1">
        <div
          className={`h-full ${depth}`}
          style={{ width: `${share * 100}%` }}
          role="img"
          aria-label={`${label}: ${value} of ${total}`}
        />
      </div>
      <span className="w-16 shrink-0 text-right text-xs tabular-nums text-slate">
        {value}/{total}
      </span>
    </div>
  )
}

import type { Coverage as CoverageData, SubjectCoverage } from '@/api/progress'

/**
 * Three bars per subject: read once, revised twice, practised. They are nested
 * rather than stacked — every topic revised has been read, and every topic
 * practised has usually been read too — so the bars sit one under another at
 * the same width and the shortfall between them is the thing to see.
 *
 * Depth of fill carries the meaning: the deeper the bar, the further through
 * that topic she is.
 *
 * Fourteen subjects in one column is a scroll rather than a picture, so on a
 * wide screen they lay out two and then three across. On a phone the single
 * column stays — a list is the right shape there.
 */
export function Coverage({ data }: { data: CoverageData }) {
  return (
    <div>
      <div className="overflow-hidden">
        <div className="-mb-px -mr-px grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3">
          {data.subjects.map((subject) => (
            <SubjectCell key={subject.subject} row={subject} />
          ))}
        </div>
      </div>
      {data.totals && data.subjects.length > 1 && (
        <div className="border-t border-hairline bg-canvas">
          <SubjectCell row={data.totals} muted />
        </div>
      )}
    </div>
  )
}

function SubjectCell({ row, muted = false }: { row: SubjectCoverage; muted?: boolean }) {
  return (
    <div
      className={`border-hairline px-4 py-3.5 sm:px-5 ${
        muted ? '' : 'border-b border-r'
      }`}
    >
      <div className="flex items-baseline justify-between pb-2">
        <h3 className={`text-sm ${muted ? 'font-medium text-muted' : 'font-medium text-ink'}`}>
          {row.label}
        </h3>
        <span className="text-xs tabular-nums text-faint">{row.leaves} topics</span>
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
    <div className="flex items-center gap-3 py-1">
      <span className="w-24 shrink-0 text-xs text-muted">{label}</span>
      <div className="h-2.5 min-w-8 flex-1 overflow-hidden rounded-full bg-hairline">
        <div
          className={`h-full rounded-full transition-[width] duration-700 ${depth}`}
          style={{ width: `${share * 100}%` }}
          role="img"
          aria-label={`${label}: ${value} of ${total}`}
        />
      </div>
      <span className="w-16 shrink-0 text-right text-xs tabular-nums text-muted">
        {value}/{total}
      </span>
      <span className="hidden w-10 shrink-0 text-right text-xs tabular-nums text-faint sm:block">
        {Math.round(share * 100)}%
      </span>
    </div>
  )
}

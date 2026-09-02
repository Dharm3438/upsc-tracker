import type { MistakeSummary, MistakeTag } from '@/api/mistakes'

/**
 * The most diagnostically useful view in the app, so it gets room: one bar,
 * then a legend that names each tag with its count and share.
 *
 * The five tags take the five depth tones rather than five hues. Nothing here
 * is better or worse than anything else — "careless" is not a red state — the
 * segments only need to be told apart.
 */
const TONE: Record<MistakeTag, { fill: string; swatch: string }> = {
  unknown: { fill: 'bg-depth-5', swatch: 'bg-depth-5' },
  silly: { fill: 'bg-depth-4', swatch: 'bg-depth-4' },
  elimination: { fill: 'bg-depth-3', swatch: 'bg-depth-3' },
  misread: { fill: 'bg-depth-2', swatch: 'bg-depth-2' },
  guess: { fill: 'bg-depth-1', swatch: 'bg-depth-1' },
}

export function TagBar({
  summary,
  selected,
  onSelect,
}: {
  summary: MistakeSummary
  selected?: MistakeTag
  onSelect: (tag: MistakeTag | undefined) => void
}) {
  if (summary.total === 0) return null
  const shown = summary.by_tag.filter((row) => row.count > 0)

  return (
    <div className="px-4 pb-4">
      <div className="flex h-3 w-full overflow-hidden rounded-full bg-paper">
        {shown.map((row) => (
          <div
            key={row.tag}
            className={TONE[row.tag].fill}
            style={{ width: `${(row.count / summary.total) * 100}%` }}
            // The legend below carries the same numbers in text, so the bar
            // itself is decoration as far as a screen reader is concerned.
            aria-hidden
          />
        ))}
      </div>

      <ul className="mt-3 space-y-1">
        {shown.map((row) => (
          <li key={row.tag}>
            <button
              type="button"
              aria-pressed={selected === row.tag}
              // Tapping a tag filters the list; tapping it again clears it.
              onClick={() => onSelect(selected === row.tag ? undefined : row.tag)}
              className={[
                'flex w-full items-center gap-2 rounded py-1 text-left text-sm',
                selected === row.tag ? 'text-ink' : 'text-slate',
              ].join(' ')}
            >
              <span className={`h-2.5 w-2.5 shrink-0 rounded-sm ${TONE[row.tag].swatch}`} />
              <span className={selected === row.tag ? 'font-medium' : undefined}>
                {row.label}
              </span>
              <span className="ml-auto tabular-nums">{row.count}</span>
              <span className="w-10 text-right tabular-nums text-slate">
                {Math.round((row.count / summary.total) * 100)}%
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}

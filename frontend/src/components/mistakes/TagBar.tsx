import { X } from 'lucide-react'

import type { MistakeSummary, MistakeTag } from '@/api/mistakes'
import { Button } from '@/components/ui'
import { cn } from '@/lib/cn'

/**
 * The most diagnostically useful view in the app, so it gets room: one bar,
 * then a legend that names each tag with its count and share.
 *
 * The five tags get five *hues*, not five steps of the confidence ramp. These
 * are categories, not an ordinal scale — "careless" is not more of anything
 * than "misread it" — and five shades of one colour are near-impossible to
 * match back to a legend.
 */
const TONE: Record<MistakeTag, { bar: string; swatch: string }> = {
  unknown: { bar: 'bg-tag-unknown', swatch: 'bg-tag-unknown' },
  silly: { bar: 'bg-tag-silly', swatch: 'bg-tag-silly' },
  elimination: { bar: 'bg-tag-elimination', swatch: 'bg-tag-elimination' },
  misread: { bar: 'bg-tag-misread', swatch: 'bg-tag-misread' },
  guess: { bar: 'bg-tag-guess', swatch: 'bg-tag-guess' },
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
    <div className="p-4 sm:p-5">
      <div className="flex h-2.5 w-full gap-0.5 overflow-hidden rounded-full bg-hairline">
        {shown.map((row) => (
          <div
            key={row.tag}
            className={cn(
              'transition-opacity first:rounded-l-full last:rounded-r-full',
              TONE[row.tag].bar,
              selected && selected !== row.tag && 'opacity-30',
            )}
            style={{ width: `${(row.count / summary.total) * 100}%` }}
            // The legend below carries the same numbers in text, so the bar
            // itself is decoration as far as a screen reader is concerned.
            aria-hidden
          />
        ))}
      </div>

      <ul className="mt-3 space-y-0.5">
        {shown.map((row) => (
          <li key={row.tag}>
            <button
              type="button"
              aria-pressed={selected === row.tag}
              // Tapping a tag filters the list; tapping it again clears it.
              onClick={() => onSelect(selected === row.tag ? undefined : row.tag)}
              className={cn(
                'flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left text-sm transition-colors',
                selected === row.tag
                  ? 'bg-accent-soft font-medium text-ink'
                  : 'text-muted hover:bg-canvas hover:text-ink',
              )}
            >
              <span className={cn('h-2.5 w-2.5 shrink-0 rounded-sm', TONE[row.tag].swatch)} />
              <span className="min-w-0 truncate">{row.label}</span>
              <span className="ml-auto shrink-0 tabular-nums">{row.count}</span>
              <span className="w-10 shrink-0 text-right tabular-nums text-faint">
                {Math.round((row.count / summary.total) * 100)}%
              </span>
            </button>
          </li>
        ))}
      </ul>

      {selected && (
        <Button
          size="sm"
          variant="ghost"
          className="mt-2"
          icon={<X size={13} strokeWidth={2.2} />}
          onClick={() => onSelect(undefined)}
        >
          Clear the filter
        </Button>
      )}
    </div>
  )
}

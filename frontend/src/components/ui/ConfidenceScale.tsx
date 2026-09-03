import { cn } from '@/lib/cn'
import { DEPTH_BG, DEPTH_TEXT } from '@/lib/tokens'

const SCORES = [1, 2, 3, 4, 5] as const

/**
 * The 1-5 recall grade, as depth of fill rather than traffic lights: the scale
 * reads as what it measures. Previously copy-pasted into GradeSheet and
 * QuickLogSheet, each with its own DEPTH map.
 */
export function ConfidenceScale({
  value,
  onChange,
  disabled = false,
  size = 'md',
  legend = false,
}: {
  value?: number | null
  onChange: (score: number) => void
  disabled?: boolean
  size?: 'md' | 'lg'
  legend?: boolean
}) {
  return (
    <div>
      <div className="flex gap-2" role="group" aria-label="Confidence, 1 to 5">
        {SCORES.map((score) => {
          const selected = value === score
          return (
            <button
              key={score}
              type="button"
              aria-pressed={selected}
              disabled={disabled}
              onClick={() => onChange(score)}
              className={cn(
                'flex-1 rounded-md border text-sm font-medium transition-all disabled:opacity-50',
                size === 'lg' ? 'h-14' : 'h-10',
                DEPTH_BG[score],
                DEPTH_TEXT[score],
                selected
                  ? 'border-accent ring-2 ring-accent-ring'
                  : 'border-hairline hover:border-edge',
              )}
            >
              {score}
            </button>
          )
        })}
      </div>
      {legend && (
        <p className="pt-2 text-xs text-muted">1 — gone · 3 — patchy · 5 — came straight back</p>
      )}
    </div>
  )
}

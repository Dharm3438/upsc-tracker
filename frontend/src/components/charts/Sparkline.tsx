import { COLOR } from '@/lib/tokens'

/**
 * Ten accuracies, no axes, no labels. It answers one question — is this going
 * up or down — and anything more would need room the header does not have.
 *
 * The band is fixed to 30–90%: scaling to the data would make a two-point
 * wobble look like a collapse, which is exactly the anxiety this app is meant
 * to avoid manufacturing.
 */
const FLOOR = 0.3
const CEILING = 0.9

export function Sparkline({
  values,
  /** What the line is of. Answers reuse it for the self-score share. */
  what = 'Accuracy',
  width = 88,
  height = 24,
}: {
  values: number[]
  what?: string
  width?: number
  height?: number
}) {
  // One point is a dot, not a trend; two is the minimum that says anything.
  if (values.length < 2) return null

  const step = width / (values.length - 1)
  const points = values.map((value, index) => {
    const clamped = Math.min(CEILING, Math.max(FLOOR, value))
    const y = height - ((clamped - FLOOR) / (CEILING - FLOOR)) * height
    return [index * step, y] as const
  })
  const last = points[points.length - 1]
  const line = points.map(([x, y]) => `${x},${y}`).join(' ')

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className="overflow-visible"
      role="img"
      aria-label={`${what} over the last ${values.length} attempts, now ${percent(
        values[values.length - 1],
      )}`}
    >
      {/* The floor of the band, so a flat line still reads as sitting somewhere. */}
      <line
        x1="0"
        y1={height}
        x2={width}
        y2={height}
        stroke={COLOR.hairline}
        strokeWidth="1"
      />
      {/* A wash under the line. At 88px the stroke alone disappears into the card. */}
      <polygon
        points={`0,${height} ${line} ${width},${height}`}
        fill="currentColor"
        fillOpacity="0.12"
      />
      <polyline
        points={line}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      <circle cx={last[0]} cy={last[1]} r="2.4" fill="currentColor" />
    </svg>
  )
}

export function percent(value: number | null): string {
  if (value === null) return '—'
  return `${Math.round(value * 100)}%`
}

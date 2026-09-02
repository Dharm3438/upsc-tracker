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
const WIDTH = 88
const HEIGHT = 24

export function Sparkline({ values }: { values: number[] }) {
  // One point is a dot, not a trend; two is the minimum that says anything.
  if (values.length < 2) return null

  const step = WIDTH / (values.length - 1)
  const points = values.map((value, index) => {
    const clamped = Math.min(CEILING, Math.max(FLOOR, value))
    const y = HEIGHT - ((clamped - FLOOR) / (CEILING - FLOOR)) * HEIGHT
    return [index * step, y] as const
  })
  const last = points[points.length - 1]

  return (
    <svg
      width={WIDTH}
      height={HEIGHT}
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      className="overflow-visible"
      role="img"
      aria-label={`Accuracy over the last ${values.length} attempts, now ${percent(
        values[values.length - 1],
      )}`}
    >
      <polyline
        points={points.map(([x, y]) => `${x},${y}`).join(' ')}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      <circle cx={last[0]} cy={last[1]} r="2.2" fill="currentColor" />
    </svg>
  )
}

export function percent(value: number | null): string {
  if (value === null) return '—'
  return `${Math.round(value * 100)}%`
}

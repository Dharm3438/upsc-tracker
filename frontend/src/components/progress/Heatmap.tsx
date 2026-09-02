import { useNavigate } from 'react-router-dom'

import type { HeatmapCell, HeatmapSection } from '@/api/progress'

/** Past this a topic is not merely late, and it earns the one warm tone in the
 *  palette — the same threshold the due list uses. */
const OVERDUE_ATTENTION_DAYS = 14

const DEPTH = ['bg-depth-1', 'bg-depth-2', 'bg-depth-3', 'bg-depth-4', 'bg-depth-5']

/**
 * The syllabus as a field of squares, grouped under its sections. Depth of fill
 * is confidence: pale is weak, saturated is strong, and a topic never graded is
 * an outline rather than a colour — never studied and badly remembered are
 * different facts and should not look alike.
 *
 * Tapping a square opens the topic, which is what makes this a way into the
 * syllabus rather than a picture of it.
 */
export function Heatmap({ sections }: { sections: HeatmapSection[] }) {
  return (
    <div className="bg-surface">
      {sections.map((section) => (
        <div
          key={`${section.paper}/${section.section}`}
          className="border-b border-line px-4 py-3 last:border-b-0"
        >
          <div className="flex items-baseline justify-between pb-2">
            <h3 className="text-sm font-medium">{section.section}</h3>
            <span className="text-xs text-slate">{section.label}</span>
          </div>
          <div className="flex flex-wrap gap-1">
            {section.cells.map((cell) => (
              <Square key={cell.node_id} cell={cell} />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

function Square({ cell }: { cell: HeatmapCell }) {
  const navigate = useNavigate()
  const overdue = cell.days_overdue > OVERDUE_ATTENTION_DAYS

  return (
    <button
      type="button"
      onClick={() => navigate(`/syllabus/node/${cell.node_id}`)}
      title={label(cell)}
      aria-label={label(cell)}
      className={[
        'h-5 w-5 rounded-[3px] border',
        cell.confidence
          ? `${DEPTH[cell.confidence - 1]} border-transparent`
          : 'bg-paper border-line',
        overdue ? 'border-overdue' : '',
      ].join(' ')}
    />
  )
}

function label(cell: HeatmapCell): string {
  if (!cell.started) return `${cell.title} — not started`
  const confidence = cell.confidence ? `${cell.confidence}/5` : 'read, not yet graded'
  if (cell.days_overdue > 0) {
    return `${cell.title} — ${confidence}, ${cell.days_overdue} days overdue`
  }
  return `${cell.title} — ${confidence}`
}

/** Five depths and an outline, named once so the field of squares is readable
 *  without tapping one. */
export function HeatmapLegend() {
  return (
    <div className="flex items-center gap-2 px-4 pb-2 text-xs text-slate">
      <span>Not started</span>
      <span className="h-3 w-3 rounded-[3px] border border-line bg-paper" />
      {DEPTH.map((depth, index) => (
        <span key={depth} className={`h-3 w-3 rounded-[3px] ${depth}`} aria-hidden>
          <span className="sr-only">{index + 1}</span>
        </span>
      ))}
      <span>Strong</span>
    </div>
  )
}

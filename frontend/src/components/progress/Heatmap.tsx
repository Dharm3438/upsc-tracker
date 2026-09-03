import { useNavigate } from 'react-router-dom'

import type { HeatmapCell, HeatmapSection } from '@/api/progress'
import { cn } from '@/lib/cn'
import { ATTENTION_DAYS, DEPTH_BG } from '@/lib/tokens'

const DEPTH = [DEPTH_BG[1], DEPTH_BG[2], DEPTH_BG[3], DEPTH_BG[4], DEPTH_BG[5]]

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
    // Two columns of sections once there is width for them; a 200-topic subject
    // in one column is a scroll nobody finishes.
    <div className="grid gap-x-8 sm:grid-cols-2 xl:grid-cols-3">
      {sections.map((section) => (
        <div
          key={`${section.subject}/${section.section}`}
          className="border-b border-hairline px-4 py-3.5 sm:px-5"
        >
          <div className="flex items-baseline justify-between gap-3 pb-2">
            <h3 className="truncate text-sm font-medium text-ink">{section.section}</h3>
            <span className="shrink-0 text-xs tabular-nums text-faint">
              {section.cells.length}
            </span>
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
  const overdue = cell.days_overdue > ATTENTION_DAYS

  return (
    <button
      type="button"
      onClick={() => navigate(`/syllabus/node/${cell.node_id}`)}
      title={label(cell)}
      aria-label={label(cell)}
      className={cn(
        'h-4 w-4 rounded-[4px] border transition-transform hover:scale-125 sm:h-5 sm:w-5 lg:h-6 lg:w-6',
        cell.confidence
          ? `${DEPTH[cell.confidence - 1]} border-transparent`
          : 'border-hairline bg-canvas',
        // A ring rather than a border swap: never-started cells already use
        // their border, so recolouring it would say two things at once.
        overdue && 'ring-1 ring-danger',
      )}
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
    <div className="flex items-center gap-1.5 text-xs text-faint">
      <span className="hidden sm:inline">Not started</span>
      <span className="h-3 w-3 rounded-[3px] border border-hairline bg-canvas" />
      {DEPTH.map((depth, index) => (
        <span key={depth} className={`h-3 w-3 rounded-[3px] ${depth}`} aria-hidden>
          <span className="sr-only">{index + 1}</span>
        </span>
      ))}
      <span className="hidden sm:inline">Strong</span>
    </div>
  )
}

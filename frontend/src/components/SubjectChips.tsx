import type { Stage, Subject, SubjectSummary } from '@/api/syllabus'
import { Chip, ChipRow } from '@/components/ui'

const STAGE_LABEL: Record<Stage, string> = {
  PRELIMS: 'Prelims',
  MAINS: 'Mains',
}

const STAGES: Stage[] = ['PRELIMS', 'MAINS']

/**
 * The subject rail, split into Prelims and Mains.
 *
 * Thirteen chips in one run is a wall you have to read left to right; under two
 * headings it is two short lists you can aim at. The split is presentational —
 * nothing downstream cares which stage a subject sits in.
 *
 * `grouped` is opt-out because the narrow filter rows on Progress and Notes
 * want the flat run: there the chips are a filter, not a place to navigate to.
 */
export function SubjectChips({
  subjects,
  selected,
  onSelect,
  showCounts = false,
  grouped = false,
}: {
  subjects: SubjectSummary[]
  selected: Subject
  onSelect: (subject: Subject) => void
  showCounts?: boolean
  grouped?: boolean
}) {
  if (!grouped) {
    return <Row subjects={subjects} {...{ selected, onSelect, showCounts }} />
  }

  return (
    <div className="space-y-2">
      {STAGES.map((stage) => {
        const inStage = subjects.filter((subject) => subject.stage === stage)
        if (inStage.length === 0) return null
        return (
          <div key={stage}>
            <h3 className="px-0.5 pb-1.5 text-[11px] font-medium uppercase tracking-wide text-faint">
              {STAGE_LABEL[stage]}
            </h3>
            <Row subjects={inStage} {...{ selected, onSelect, showCounts }} />
          </div>
        )
      })}
    </div>
  )
}

function Row({
  subjects,
  selected,
  onSelect,
  showCounts,
}: {
  subjects: SubjectSummary[]
  selected: Subject
  onSelect: (subject: Subject) => void
  showCounts?: boolean
}) {
  return (
    <ChipRow>
      {subjects.map((subject) => (
        <Chip
          key={subject.subject}
          selected={subject.subject === selected}
          onClick={() => onSelect(subject.subject)}
          count={showCounts ? subject.topics : undefined}
        >
          {subject.label}
        </Chip>
      ))}
    </ChipRow>
  )
}

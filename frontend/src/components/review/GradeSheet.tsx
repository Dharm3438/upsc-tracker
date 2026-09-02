import { useState } from 'react'

import type { DueNode } from '@/api/review'
import { Sheet } from '@/components/shell/Sheet'
import { ConfidenceScale } from '@/components/ui/ConfidenceScale'
import { Callout } from '@/components/ui/Callout'
import { toast } from '@/components/shell/Toast'
import { useCreateLog } from '@/hooks/useLogs'
import { formatDayIST } from '@/lib/date'
import { readable } from '@/lib/errors'

/**
 * Grading one due topic. Tapping a confidence saves — there is no second
 * confirm step, because the whole flow is meant to be one tap per topic and a
 * second one would double the cost of a six-topic morning.
 *
 * A grade is an ordinary `revise` log, so it runs through the same endpoint and
 * the same SM-2 side-effect as anything logged by hand, and it can be undone
 * from the node's timeline like anything else.
 */
export function GradeSheet({ node, onClose }: { node: DueNode; onClose: () => void }) {
  const [error, setError] = useState<string | null>(null)
  const create = useCreateLog()

  function grade(confidence: number) {
    setError(null)
    create.mutate(
      {
        node_id: node.node_id,
        type: 'revise',
        // Grading from the due list *is* recall: she is answering from memory
        // with the topic title as the only prompt.
        payload: { confidence, method: 'recall' },
      },
      {
        onSuccess: (result) => {
          toast(result.next_due ? `Back on ${formatDayIST(result.next_due)}.` : 'Saved.')
          onClose()
        },
        onError: (caught) => setError(readable(caught)),
      },
    )
  }

  const crumbs = node.path.split('/').slice(0, -1).join(' › ')

  return (
    <Sheet title={node.title} onClose={onClose}>
      <div className="space-y-4 p-4 sm:p-5">
        <div>
          <p className="text-xs text-muted">{crumbs}</p>
          <p className="mt-1 text-sm text-muted">{history(node)}</p>
        </div>

        {node.notes && (
          <p className="whitespace-pre-wrap border-l-2 border-accent-ring pl-3 text-sm text-ink">
            {node.notes}
          </p>
        )}

        <div>
          <p className="pb-1.5 text-xs font-medium text-muted">How well did that come back?</p>
          <ConfidenceScale
            value={null}
            size="lg"
            legend
            disabled={create.isPending}
            onChange={grade}
          />
        </div>

        {error && <Callout tone="danger">{error}</Callout>}
      </div>
    </Sheet>
  )
}

/** What the app knows about this topic, in one line. */
function history(node: DueNode): string {
  const parts: string[] = []
  if (node.last_confidence) parts.push(`last ${node.last_confidence}/5`)
  if (node.repetitions > 0) {
    parts.push(node.repetitions === 1 ? '1 revision' : `${node.repetitions} revisions`)
  }
  if (node.lapses > 0) parts.push(node.lapses === 1 ? '1 lapse' : `${node.lapses} lapses`)
  if (node.days_overdue > 0) parts.push(`${node.days_overdue} days late`)
  return parts.length ? parts.join(' · ') : 'Read once, never recalled.'
}


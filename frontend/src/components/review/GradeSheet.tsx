import { useState } from 'react'

import type { DueNode } from '@/api/review'
import { Sheet } from '@/components/shell/Sheet'
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
      <div className="space-y-4 p-4">
        <div>
          <p className="text-xs text-slate">{crumbs}</p>
          <p className="mt-1 text-sm text-slate">{history(node)}</p>
        </div>

        {node.notes && (
          <p className="whitespace-pre-wrap border-l-2 border-line pl-3 text-sm">
            {node.notes}
          </p>
        )}

        <div>
          <p className="pb-1.5 text-xs text-slate">How well did that come back?</p>
          <div className="flex gap-2" role="group" aria-label="Confidence, 1 to 5">
            {[1, 2, 3, 4, 5].map((score) => (
              <button
                key={score}
                type="button"
                disabled={create.isPending}
                onClick={() => grade(score)}
                // Depth of fill, not traffic lights: pale is weak, deep is
                // strong, and the scale reads as what it measures.
                className={`h-14 flex-1 rounded border border-line text-sm disabled:opacity-60 ${DEPTH[score]}`}
              >
                {score}
              </button>
            ))}
          </div>
          <p className="pt-1.5 text-xs text-slate">
            1 — gone · 3 — patchy · 5 — came straight back
          </p>
        </div>

        {error && <p className="text-sm text-overdue">{error}</p>}
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

const DEPTH: Record<number, string> = {
  1: 'bg-depth-1 text-ink',
  2: 'bg-depth-2 text-ink',
  3: 'bg-depth-3 text-ink',
  4: 'bg-depth-4 text-surface',
  5: 'bg-depth-5 text-surface',
}

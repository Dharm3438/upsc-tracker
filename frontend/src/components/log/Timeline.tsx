import { useState } from 'react'

import type { Log } from '@/api/logs'
import { EmptyState } from '@/components/EmptyState'
import { toast } from '@/components/shell/Toast'
import { useDeleteLog, useNodeLogs } from '@/hooks/useLogs'
import { formatDayIST } from '@/lib/date'
import { readable } from '@/lib/errors'

/** Everything logged against one node, newest first. */
export function Timeline({ nodeId }: { nodeId: string }) {
  const logs = useNodeLogs(nodeId)
  const items = logs.data?.pages.flatMap((page) => page.items) ?? []

  if (logs.isError) return <EmptyState>Could not load the timeline.</EmptyState>
  if (logs.isPending) return <EmptyState>Loading…</EmptyState>
  if (items.length === 0) {
    return <EmptyState>Not started. Log a reading to begin tracking it.</EmptyState>
  }

  return (
    <>
      <ul>
        {items.map((log) => (
          <Entry key={log._id} log={log} />
        ))}
      </ul>
      {logs.hasNextPage && (
        <button
          type="button"
          onClick={() => void logs.fetchNextPage()}
          disabled={logs.isFetchingNextPage}
          className="h-tap w-full border-t border-line text-sm text-signal"
        >
          {logs.isFetchingNextPage ? 'Loading…' : 'Show older'}
        </button>
      )}
    </>
  )
}

function Entry({ log }: { log: Log }) {
  const [confirming, setConfirming] = useState(false)
  const remove = useDeleteLog()

  function undo() {
    remove.mutate(log._id, {
      onSuccess: () => toast('Entry removed.'),
      onError: (error) => toast(readable(error, 'That did not delete.')),
    })
  }

  return (
    <li className="flex min-h-tap items-center gap-3 border-b border-line px-4 py-2 last:border-0">
      <div className="min-w-0 flex-1">
        <p className="text-sm">{describe(log)}</p>
        <p className="text-xs text-slate">{formatDayIST(log.date)}</p>
      </div>
      {confirming ? (
        <span className="flex shrink-0 items-center gap-3">
          <button type="button" onClick={undo} className="text-sm text-overdue">
            {remove.isPending ? '…' : 'Delete'}
          </button>
          <button
            type="button"
            onClick={() => setConfirming(false)}
            className="text-sm text-slate"
          >
            Keep
          </button>
        </span>
      ) : (
        <button
          type="button"
          onClick={() => setConfirming(true)}
          aria-label={`Remove the entry from ${formatDayIST(log.date)}`}
          className="shrink-0 px-2 text-sm text-slate"
        >
          ⋯
        </button>
      )}
    </li>
  )
}

/** One line in her words, not a field dump. */
function describe(log: Log): string {
  const minutes = log.minutes ? ` · ${log.minutes} min` : ''

  if (log.type === 'read') {
    // Without a source the sentence is just "Read", not "Read Read".
    const source = log.payload.source ? ` ${log.payload.source}` : ''
    const pages =
      log.payload.from_page != null && log.payload.to_page != null
        ? ` p. ${log.payload.from_page}–${log.payload.to_page}`
        : ''
    const confidence = log.payload.confidence ? ` · ${log.payload.confidence}/5` : ''
    return `Read${source}${pages}${confidence}${minutes}`
  }

  if (log.type === 'revise') {
    return `Revised (${log.payload.method}) · ${log.payload.confidence}/5${minutes}`
  }

  if (log.type === 'mcq') {
    const { attempted = 0, correct = 0 } = log.payload
    const accuracy = attempted ? ` · ${Math.round((correct / attempted) * 100)}%` : ''
    return `${correct}/${attempted} MCQs${accuracy}${minutes}`
  }

  if (log.type === 'answer') return `Answer written${minutes}`
  return `Current affairs tagged${minutes}`
}


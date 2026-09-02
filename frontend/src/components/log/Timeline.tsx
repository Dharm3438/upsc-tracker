import { useState } from 'react'
import { Trash2 } from 'lucide-react'

import type { Log } from '@/api/logs'
import { toast } from '@/components/shell/Toast'
import { Button, EmptyState, QueryBoundary, SkeletonRows } from '@/components/ui'
import { useDeleteLog, useNodeLogs } from '@/hooks/useLogs'
import { LOG_ICON, describeLog } from '@/lib/logText'
import { formatDayIST } from '@/lib/date'
import { readable } from '@/lib/errors'

/** Everything logged against one node, newest first. */
export function Timeline({ nodeId }: { nodeId: string }) {
  const logs = useNodeLogs(nodeId)
  const items = logs.data?.pages.flatMap((page) => page.items) ?? []

  return (
    <>
      <QueryBoundary
        query={logs}
        error="Could not load the timeline."
        skeleton={<SkeletonRows rows={3} />}
        isEmpty={() => items.length === 0}
        empty={
          <EmptyState
            size="sm"
            title="Not started."
            description="Log a reading and it will begin tracking here."
          />
        }
      >
        {() => (
          <ul className="divide-y divide-hairline">
            {items.map((log) => (
              <Entry key={log._id} log={log} />
            ))}
          </ul>
        )}
      </QueryBoundary>

      {logs.hasNextPage && (
        <Button
          variant="ghost"
          full
          className="rounded-none border-t border-hairline"
          loading={logs.isFetchingNextPage}
          onClick={() => void logs.fetchNextPage()}
        >
          Show older
        </Button>
      )}
    </>
  )
}

function Entry({ log }: { log: Log }) {
  const [confirming, setConfirming] = useState(false)
  const remove = useDeleteLog()
  const Icon = LOG_ICON[log.type]

  function undo() {
    remove.mutate(log._id, {
      onSuccess: () => toast('Entry removed.'),
      onError: (error) => toast(readable(error, 'That did not delete.'), 'error'),
    })
  }

  return (
    <li className="group/log flex min-h-tap items-center gap-3 px-4 py-2.5 sm:px-5">
      <span className="shrink-0 rounded-md bg-hairline/60 p-1.5 text-muted">
        <Icon size={14} strokeWidth={1.8} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm text-ink">{describeLog(log)}</p>
        <p className="text-xs text-muted">{formatDayIST(log.date)}</p>
      </div>
      {confirming ? (
        <span className="flex shrink-0 items-center gap-1.5">
          <Button size="sm" variant="danger" loading={remove.isPending} onClick={undo}>
            Delete
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setConfirming(false)}>
            Keep
          </Button>
        </span>
      ) : (
        <button
          type="button"
          onClick={() => setConfirming(true)}
          aria-label={`Remove the entry from ${formatDayIST(log.date)}`}
          className="shrink-0 rounded-md p-2 text-faint opacity-0 transition-opacity hover:bg-danger-soft hover:text-danger focus-visible:opacity-100 group-hover/log:opacity-100"
        >
          <Trash2 size={15} strokeWidth={1.9} />
        </button>
      )}
    </li>
  )
}

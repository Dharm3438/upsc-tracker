import { History } from 'lucide-react'
import { Link } from 'react-router-dom'

import { Card, CardHeader, EmptyState, QueryBoundary, SkeletonRows } from '@/components/ui'
import { useRecentLogs } from '@/hooks/useLogs'
import { formatDayIST, todayIST } from '@/lib/date'
import { LOG_ICON, describeLog } from '@/lib/logText'

/** What has actually been done lately, across every topic. The node timeline
 *  answers "what happened to this topic"; this answers "what have I been doing". */
export function RecentActivity() {
  const logs = useRecentLogs(6)
  const today = todayIST()

  return (
    <Card className="col-span-12 md:col-span-6 lg:col-span-4">
      <CardHeader
        title="Recent activity"
        subtitle="The last few things logged, newest first."
        icon={<History size={17} strokeWidth={1.8} />}
      />
      <QueryBoundary
        query={logs}
        error="Could not load your activity."
        skeleton={<SkeletonRows rows={4} />}
        isEmpty={(data) => data.items.length === 0}
        empty={
          <EmptyState
            title="Nothing logged yet."
            description="Anything you read or revise shows up here."
          />
        }
      >
        {(data) => (
          <ul className="divide-y divide-hairline">
            {data.items.map((log) => {
              const Icon = LOG_ICON[log.type]
              return (
                <li key={log._id}>
                  <Link
                    to={`/syllabus/node/${log.node_id}`}
                    className="flex items-center gap-3 px-4 py-2.5 transition-colors hover:bg-canvas sm:px-5"
                  >
                    <span className="shrink-0 rounded-md bg-hairline/60 p-1.5 text-muted">
                      <Icon size={15} strokeWidth={1.8} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm text-ink">
                        {log.node_title ?? 'A topic'}
                      </span>
                      <span className="block truncate text-xs text-muted">{describeLog(log)}</span>
                    </span>
                    <span className="shrink-0 text-xs tabular-nums text-faint">
                      {log.date === today ? 'today' : formatDayIST(log.date)}
                    </span>
                  </Link>
                </li>
              )
            })}
          </ul>
        )}
      </QueryBoundary>
    </Card>
  )
}

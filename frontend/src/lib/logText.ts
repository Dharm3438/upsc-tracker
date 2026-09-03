import { BookOpen, ListChecks, Newspaper, PenLine, RotateCcw } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

import type { Log, LogType } from '@/api/logs'

/** One line in her words, not a field dump. Shared by the node timeline and the
 *  recent-activity widget on the dashboard. */
export function describeLog(log: Log): string {
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

export const LOG_ICON: Record<LogType, LucideIcon> = {
  read: BookOpen,
  revise: RotateCcw,
  mcq: ListChecks,
  answer: PenLine,
  ca: Newspaper,
}

export const LOG_LABEL: Record<LogType, string> = {
  read: 'Read',
  revise: 'Revised',
  mcq: 'MCQs',
  answer: 'Answer',
  ca: 'Current affairs',
}

import { api } from './client'

import type { Subject } from './syllabus'

export type LogType = 'read' | 'revise' | 'mcq' | 'answer' | 'ca'
export type ReviseMethod = 'notes' | 'book' | 'recall' | 'mindmap'

export type ReadPayload = {
  source: string
  from_page: number | null
  to_page: number | null
  confidence: number
}

export type RevisePayload = { confidence: number; method: ReviseMethod }

export type McqPayload = {
  test_id: string | null
  attempted: number
  correct: number
  skipped: number
}

export type LogPayload = Partial<ReadPayload & RevisePayload & McqPayload> & {
  answer_id?: string
  ca_id?: string
}

export type Log = {
  _id: string
  node_id: string
  type: LogType
  date: string
  minutes: number | null
  payload: LogPayload
  created_at: string | null
  node_title: string | null
  node_path: string | null
}

export type ReviewState = {
  node_id: string
  repetitions: number
  ease_factor: number
  interval_days: number
  last_reviewed: string | null
  next_due: string | null
  last_confidence: number | null
  lapses: number
}

export type LogCreated = {
  log: Log
  review_state: ReviewState | null
  next_due: string | null
}

export type LogPage = { items: Log[]; next_cursor: string | null }

export type RecentNode = {
  node_id: string
  title: string
  path: string
  subject: Subject
  last_logged: string
}

export type NewLog = {
  node_id: string
  type: LogType
  date?: string
  minutes?: number | null
  payload: LogPayload
}

export const createLog = (body: NewLog) =>
  api<LogCreated>('/logs', { method: 'POST', body })

export const deleteLog = (id: string) =>
  api<void>(`/logs/${id}`, { method: 'DELETE' })

export const getRecentNodes = () => api<RecentNode[]>('/logs/recent-nodes')

export function getLogs(params: {
  nodeId?: string
  type?: LogType
  limit?: number
  cursor?: string
}) {
  const query = new URLSearchParams()
  if (params.nodeId) query.set('node_id', params.nodeId)
  if (params.type) query.set('type', params.type)
  if (params.limit) query.set('limit', String(params.limit))
  if (params.cursor) query.set('cursor', params.cursor)
  return api<LogPage>(`/logs?${query.toString()}`)
}

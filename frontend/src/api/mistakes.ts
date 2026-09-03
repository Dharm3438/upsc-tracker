import { api } from './client'

import type { Subject } from './syllabus'

export type MistakeTag = 'unknown' | 'silly' | 'elimination' | 'misread' | 'guess'

/** Labels and order match the server's, so the bar and its legend agree. */
export const TAGS: { value: MistakeTag; label: string; short: string }[] = [
  { value: 'unknown', label: "Didn't know it", short: 'Unknown' },
  { value: 'silly', label: 'Careless', short: 'Careless' },
  { value: 'elimination', label: 'Bad elimination', short: 'Elimination' },
  { value: 'misread', label: 'Misread it', short: 'Misread' },
  { value: 'guess', label: 'Wrong guess', short: 'Guess' },
]

export const tagLabel = (tag: MistakeTag): string =>
  TAGS.find((option) => option.value === tag)?.label ?? tag

export type Mistake = {
  _id: string
  source_type: 'mcq' | 'answer'
  source_id: string | null
  node_id: string
  subject: Subject
  date: string
  question: string
  tag: MistakeTag
  note: string
  resolved: boolean
  resolved_at: string | null
  created_at: string | null
  node_title: string | null
  node_path: string | null
  source_title: string | null
}

export type MistakeItem = {
  node_id: string
  tag: MistakeTag
  question?: string
  note?: string
}

export type MistakePage = { items: Mistake[]; next_cursor: string | null }

export type MistakeSummary = {
  total: number
  unresolved: number
  by_tag: { tag: MistakeTag; label: string; count: number }[]
  by_subject: { subject: Subject; count: number }[]
}

export type MistakeFilters = {
  tag?: MistakeTag
  subject?: Subject
  nodeId?: string
  sourceId?: string
  resolved?: boolean
  q?: string
}

function toQuery(filters: MistakeFilters): URLSearchParams {
  const query = new URLSearchParams()
  if (filters.tag) query.set('tag', filters.tag)
  if (filters.subject) query.set('subject', filters.subject)
  if (filters.nodeId) query.set('node_id', filters.nodeId)
  if (filters.sourceId) query.set('source_id', filters.sourceId)
  if (filters.resolved !== undefined) query.set('resolved', String(filters.resolved))
  if (filters.q) query.set('q', filters.q)
  return query
}

export function getMistakes(filters: MistakeFilters & { cursor?: string } = {}) {
  const query = toQuery(filters)
  if (filters.cursor) query.set('cursor', filters.cursor)
  return api<MistakePage>(`/mistakes?${query.toString()}`)
}

export function getMistakeSummary(filters: Pick<MistakeFilters, 'subject'> = {}) {
  return api<MistakeSummary>(`/mistakes/summary?${toQuery(filters).toString()}`)
}

export const addTestMistakes = (testId: string, items: MistakeItem[]) =>
  api<Mistake[]>(`/tests/${testId}/mistakes`, { method: 'POST', body: { items } })

export const updateMistake = (
  id: string,
  body: Partial<{ tag: MistakeTag; note: string; question: string; resolved: boolean }>,
) => api<Mistake>(`/mistakes/${id}`, { method: 'PATCH', body })

export const deleteMistake = (id: string) =>
  api<void>(`/mistakes/${id}`, { method: 'DELETE' })

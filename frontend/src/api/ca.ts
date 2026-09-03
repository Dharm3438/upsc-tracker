import { api } from './client'

import type { Subject } from './syllabus'

export type CaItem = {
  _id: string
  date: string
  /** Derived server-side from the date. What the month filter groups on. */
  month: string
  headline: string
  source: string
  note: string
  node_id: string | null
  subject: Subject | null
  tagged: boolean
  starred: boolean
  created_at: string | null
  node_title: string | null
  node_path: string | null
}

export type NewCaItem = {
  date?: string
  headline: string
  source?: string
  note?: string
  node_id?: string | null
  starred?: boolean
}

export type CaPage = { items: CaItem[]; next_cursor: string | null }

/** The inbox carries its own total: what is waiting is not what fits on a page. */
export type CaInbox = CaPage & { total: number }

export type CaMonth = { month: string; count: number; untagged: number }

export type CaFilters = {
  month?: string
  nodeId?: string
  subject?: Subject
  starred?: boolean
}

export const createCaItem = (body: NewCaItem) =>
  api<CaItem>('/ca', { method: 'POST', body })

export const getCaItem = (id: string) => api<CaItem>(`/ca/${id}`)

/** Sending `node_id: null` untags an item back into the inbox. */
export const updateCaItem = (id: string, body: Partial<NewCaItem>) =>
  api<CaItem>(`/ca/${id}`, { method: 'PATCH', body })

export const deleteCaItem = (id: string) =>
  api<void>(`/ca/${id}`, { method: 'DELETE' })

export function getCaItems(
  filters: CaFilters = {},
  page: { cursor?: string; limit?: number } = {},
) {
  const query = new URLSearchParams()
  if (filters.month) query.set('month', filters.month)
  if (filters.nodeId) query.set('node_id', filters.nodeId)
  if (filters.subject) query.set('subject', filters.subject)
  if (filters.starred) query.set('starred', 'true')
  // The tagged items are the list; the untagged ones have the inbox above it,
  // and showing them in both places would read as duplication.
  query.set('tagged', 'true')
  if (page.cursor) query.set('cursor', page.cursor)
  if (page.limit) query.set('limit', String(page.limit))
  return api<CaPage>(`/ca?${query.toString()}`)
}

export const getCaInbox = () => api<CaInbox>('/ca/inbox')

export const getCaMonths = () => api<CaMonth[]>('/ca/months')

/** "September 2026" from a 2026-09 month key. */
export function formatMonth(month: string): string {
  const [year, index] = month.split('-').map(Number)
  return new Date(Date.UTC(year, index - 1, 1)).toLocaleString('en-US', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  })
}

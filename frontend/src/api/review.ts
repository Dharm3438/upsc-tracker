import { api } from './client'

import type { Paper, PyqWeight } from './syllabus'

/** A row of the due list. Carries the node's notes so the grading sheet can
 *  open without a second request. */
export type DueNode = {
  node_id: string
  title: string
  path: string
  paper: Paper
  level: number
  pyq_weight: PyqWeight
  needs_diagram: boolean
  notes: string
  next_due: string
  /** 0 when due exactly today. */
  days_overdue: number
  last_reviewed: string | null
  last_confidence: number | null
  repetitions: number
  lapses: number
}

/** `total` counts everything due, even when `items` was capped by the limit. */
export type DueList = { date: string; total: number; items: DueNode[] }

export type UpcomingDay = { date: string; count: number }

export type Upcoming = {
  date: string
  /** Late and still ungraded. Kept out of the per-day counts. */
  overdue: number
  days: UpcomingDay[]
}

export const getDue = (limit = 50) => api<DueList>(`/review/due?limit=${limit}`)

export const getUpcoming = (days = 7) =>
  api<Upcoming>(`/review/upcoming?days=${days}`)

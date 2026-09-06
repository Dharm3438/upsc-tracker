import { api } from './client'

/** Null is "not tracked" — an unset target draws no meter rather than a zero
 *  she is permanently failing. */
export type WeekTargets = {
  new_topics: number | null
  answers: number | null
  mcqs: number | null
  study_minutes: number | null
}

export type Commitment = {
  node_id: string
  title: string
  path: string
  /** Read or revised inside the week. Nothing here is ticked by hand. */
  done: boolean
}

export type WeekActuals = {
  new_topics: number
  answers: number
  mcqs: number
  study_minutes: number
}

export type Week = {
  week_start: string
  week_end: string
  /** Days in the week she means to study on, after off-days. */
  study_days: number
  targets: WeekTargets
  /** What the burn-down implies for a week this long. Shown, never applied. */
  suggested: { new_topics: number; study_minutes: number }
  commitments: Commitment[]
  actuals: WeekActuals
  updated_at: string | null
}

export type WeekPlan = {
  week_start?: string
  targets: WeekTargets
  /** Node ids, in the order they were picked. */
  commitments: string[]
}

export const getWeek = () => api<Week>('/week')

export const saveWeekPlan = (body: WeekPlan) =>
  api<Week>('/week/plan', { method: 'POST', body })

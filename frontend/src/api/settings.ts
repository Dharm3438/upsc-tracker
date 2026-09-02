import { api } from './client'

export type DailyTargets = {
  revision_nodes: number
  answers: number
  mcqs: number
  ca_items: number
  study_minutes: number
}

export type AppSettings = {
  prelims_date: string
  mains_date: string
  daily_targets: DailyTargets
  /** Days already written off — a wedding, an illness, a planned break. */
  off_days: string[]
  /** 0 = Monday … 6 = Sunday, matching the server. Null means no standing off. */
  weekly_off_weekday: number | null
  timezone: string
  updated_at: string | null
}

export type SettingsPatch = Partial<
  Pick<AppSettings, 'prelims_date' | 'mains_date' | 'daily_targets' | 'off_days'> & {
    weekly_off_weekday: number | null
  }
>

export type WeeklyReview = {
  _id: string
  week_start: string
  what_slipped: string
  what_to_replan: string
  one_change: string
  /** Snapshotted server-side when the review was written, never recomputed. */
  nodes_covered: number
  nodes_revised: number
  answers_written: number
  avg_accuracy: number | null
  created_at: string | null
  updated_at: string | null
}

export type NewWeeklyReview = {
  week_start?: string
  what_slipped: string
  what_to_replan: string
  one_change: string
}

export const getSettings = () => api<AppSettings>('/settings')

export const updateSettings = (body: SettingsPatch) =>
  api<AppSettings>('/settings', { method: 'PATCH', body })

export const getWeeklyReviews = () => api<WeeklyReview[]>('/weekly-reviews')

export const createWeeklyReview = (body: NewWeeklyReview) =>
  api<WeeklyReview>('/weekly-reviews', { method: 'POST', body })

/** Monday-first names, in the server's numbering. */
const WEEKDAYS = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday',
]

export const weekdayName = (weekday: number | null): string =>
  weekday === null ? 'None' : WEEKDAYS[weekday]

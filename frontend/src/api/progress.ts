import { api } from './client'

import type { Paper } from './syllabus'

/** Days to an exam, and how many of them are actually study days. */
export type ExamCountdown = {
  date: string
  days: number
  study_days: number
}

export type Countdown = {
  date: string
  prelims: ExamCountdown
  mains: ExamCountdown
}

export type BurndownPoint = {
  date: string
  /** Null in the future: the actual line stops at today. */
  remaining: number | null
  required: number
}

export type Burndown = {
  date: string
  total_leaves: number
  started_leaves: number
  remaining: number
  study_days_remaining: number
  required_per_day: number
  actual_per_day: number | null
  actual_window_days: number
  projected_finish: string | null
  series: BurndownPoint[]
}

export type PaperCoverage = {
  paper: Paper
  label: string
  leaves: number
  read: number
  revised: number
  tested: number
}

export type Coverage = {
  date: string
  papers: PaperCoverage[]
  totals: PaperCoverage | null
}

export type HeatmapCell = {
  node_id: string
  title: string
  paper: Paper
  section: string
  /** 1–5, or null for a topic never graded — an empty square, not a weak one. */
  confidence: number | null
  started: boolean
  next_due: string | null
  days_overdue: number
}

export type HeatmapSection = {
  paper: Paper
  label: string
  section: string
  cells: HeatmapCell[]
}

export type Heatmap = { date: string; sections: HeatmapSection[] }

export type EffortDay = {
  date: string
  minutes: number
  logs: number
  /** A planned off-day is marked, never drawn as a zero. */
  off: boolean
}

export type Effort = {
  date: string
  days: EffortDay[]
  total_minutes: number
  average_minutes: number
  study_days: number
}

export const getCountdown = () => api<Countdown>('/progress/countdown')

export const getBurndown = () => api<Burndown>('/progress/burndown')

export const getCoverage = () => api<Coverage>('/progress/coverage')

export const getHeatmap = (paper?: Paper) =>
  api<Heatmap>(`/progress/heatmap${paper ? `?paper=${paper}` : ''}`)

export const getEffort = (days = 30) =>
  api<Effort>(`/progress/streakless-summary?days=${days}`)

/** "6h 20m" — hours over a day's study, minutes below it. */
export function formatMinutes(minutes: number): string {
  if (minutes < 60) return `${minutes}m`
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  return rest === 0 ? `${hours}h` : `${hours}h ${rest}m`
}

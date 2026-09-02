import { api } from './client'

import type { Paper } from './syllabus'

/** Mirrors the server: under half the marks allotted goes into the redo queue. */
export const REDO_THRESHOLD = 0.5

export type Answer = {
  _id: string
  date: string
  node_id: string
  paper: Paper
  question: string
  marks_allotted: number
  word_limit: number | null
  words_written: number | null
  minutes_taken: number | null
  self_score: number | null
  peer_score: number | null
  text: string
  image_urls: string[]
  model_answer_url: string
  improvements: string
  /** Derived server-side from the score. Null when it is not coming back. */
  review_due: string | null
  reviewed: boolean
  reviewed_at: string | null
  created_at: string | null
  node_title: string | null
  node_path: string | null
}

export type NewAnswer = {
  date?: string
  node_id: string
  question: string
  marks_allotted: number
  word_limit?: number | null
  words_written?: number | null
  minutes_taken?: number | null
  self_score?: number | null
  text?: string
  image_urls?: string[]
  model_answer_url?: string
  improvements?: string
}

export type AnswerTrends = {
  count: number
  average_minutes: number | null
  /** A share of the marks allotted, so 15- and 20-markers sit on one line. */
  average_score: number | null
  minutes: number[]
  scores: number[]
}

export type AnswerPage = {
  items: Answer[]
  next_cursor: string | null
  trends: AnswerTrends
}

export const createAnswer = (body: NewAnswer) =>
  api<Answer>('/answers', { method: 'POST', body })

export const getAnswer = (id: string) => api<Answer>(`/answers/${id}`)

export const updateAnswer = (
  id: string,
  body: Partial<NewAnswer> & { reviewed?: boolean },
) => api<Answer>(`/answers/${id}`, { method: 'PATCH', body })

export const deleteAnswer = (id: string) =>
  api<void>(`/answers/${id}`, { method: 'DELETE' })

export function getAnswers(
  params: { cursor?: string; limit?: number; from?: string; to?: string } = {},
) {
  const query = new URLSearchParams()
  if (params.cursor) query.set('cursor', params.cursor)
  if (params.limit) query.set('limit', String(params.limit))
  if (params.from) query.set('date_from', params.from)
  if (params.to) query.set('date_to', params.to)
  return api<AnswerPage>(`/answers?${query.toString()}`)
}

export const getRedoQueue = () => api<Answer[]>('/answers/review-queue')

/** The score as a share of the marks allotted — the only comparable form. */
export function scoreRatio(answer: Answer): number | null {
  if (answer.self_score === null || !answer.marks_allotted) return null
  return answer.self_score / answer.marks_allotted
}

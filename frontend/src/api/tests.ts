import { api } from './client'

import type { Paper } from './syllabus'

export type TestKind = 'sectional' | 'full_mock' | 'daily_quiz' | 'csat'

export const TEST_KINDS: { value: TestKind; label: string }[] = [
  { value: 'sectional', label: 'Sectional' },
  { value: 'full_mock', label: 'Full mock' },
  { value: 'daily_quiz', label: 'Daily quiz' },
  { value: 'csat', label: 'CSAT' },
]

export type Test = {
  _id: string
  date: string
  title: string
  kind: TestKind
  papers: Paper[]
  total_questions: number
  attempted: number
  correct: number
  /** Derived server-side, all four of them. */
  wrong: number
  skipped: number
  accuracy: number
  marks: number | null
  max_marks: number | null
  negative_per_wrong: number | null
  duration_minutes: number | null
  notes: string
  created_at: string | null
  mistakes_logged: number
}

export type NewTest = {
  date?: string
  title: string
  kind: TestKind
  papers: Paper[]
  total_questions: number
  attempted: number
  correct: number
  max_marks?: number | null
  negative_per_wrong?: number | null
  marks?: number | null
  duration_minutes?: number | null
  notes?: string
}

export type TestPage = {
  items: Test[]
  next_cursor: string | null
  /** Last ten accuracies, oldest first — the header sparkline. */
  trend: number[]
}

export const createTest = (body: NewTest) =>
  api<Test>('/tests', { method: 'POST', body })

export const getTest = (id: string) => api<Test>(`/tests/${id}`)

export const updateTest = (id: string, body: Partial<NewTest>) =>
  api<Test>(`/tests/${id}`, { method: 'PATCH', body })

export const deleteTest = (id: string) =>
  api<void>(`/tests/${id}`, { method: 'DELETE' })

export function getTests(params: { cursor?: string; limit?: number } = {}) {
  const query = new URLSearchParams()
  if (params.cursor) query.set('cursor', params.cursor)
  if (params.limit) query.set('limit', String(params.limit))
  return api<TestPage>(`/tests?${query.toString()}`)
}

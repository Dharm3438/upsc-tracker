import { api } from './client'

export type Paper = 'GS1' | 'GS2' | 'GS3' | 'GS4' | 'CSAT' | 'ESSAY' | 'ANTHRO1' | 'ANTHRO2'

export type PyqWeight = 'high' | 'medium' | 'low' | 'none'

export type PaperSummary = {
  paper: Paper
  label: string
  sections: number
  topics: number
  leaves: number
}

export type TreeNode = {
  _id: string
  paper: Paper
  parent_id: string | null
  title: string
  level: number
  order: number
  path: string
  pyq_weight: PyqWeight
  needs_diagram: boolean
  notes: string
  is_custom: boolean
  is_archived: boolean
  children: TreeNode[]
  // Rollups: server returns defaults until logging lands in phase 2.
  read_count: number
  revise_count: number
  mcq_accuracy: number | null
  next_due: string | null
  last_touched: string | null
}

export const getPapers = () => api<PaperSummary[]>('/syllabus/papers')

export const getTree = (paper: Paper) =>
  api<TreeNode[]>(`/syllabus/tree?paper=${paper}`)

export const searchNodes = (q: string) =>
  api<TreeNode[]>(`/syllabus/search?q=${encodeURIComponent(q)}`)

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
  // This node's own activity.
  read_count: number
  revise_count: number
  mcq_accuracy: number | null
  next_due: string | null
  last_touched: string | null
  confidence: number | null
  // Summed from everything beneath it, so a section row can show its own share.
  leaf_count: number
  leaf_started: number
  leaf_revised: number
}

export const getPapers = () => api<PaperSummary[]>('/syllabus/papers')

export const getTree = (paper: Paper) =>
  api<TreeNode[]>(`/syllabus/tree?paper=${paper}`)

export const searchNodes = (q: string) =>
  api<TreeNode[]>(`/syllabus/search?q=${encodeURIComponent(q)}`)

export type NodeCreate = {
  paper: Paper
  title: string
  parent_id: string | null
  pyq_weight?: PyqWeight
  needs_diagram?: boolean
}

export type NodePatch = {
  title?: string
  pyq_weight?: PyqWeight
  needs_diagram?: boolean
  notes?: string
  order?: number
  is_archived?: boolean
}

export const getNode = (id: string) => api<TreeNode>(`/syllabus/nodes/${id}`)

export const createNode = (body: NodeCreate) =>
  api<TreeNode>('/syllabus/nodes', { method: 'POST', body })

export const updateNode = (id: string, body: NodePatch) =>
  api<TreeNode>(`/syllabus/nodes/${id}`, { method: 'PATCH', body })

export const moveNode = (id: string, body: { parent_id: string | null; order?: number }) =>
  api<TreeNode>(`/syllabus/nodes/${id}/move`, { method: 'POST', body })

export const archiveNode = (id: string) =>
  api<TreeNode>(`/syllabus/nodes/${id}`, { method: 'DELETE' })

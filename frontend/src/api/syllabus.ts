import { api } from './client'

export type Subject =
  | 'ANCIENT_MEDIEVAL'
  | 'MODERN_HISTORY'
  | 'GEOGRAPHY'
  | 'ECONOMICS'
  | 'POLITY'
  | 'SCIENCE'
  | 'CSAT'
  | 'DISASTER_MGMT'
  | 'IR'
  | 'SECURITY'
  | 'WORLD_HISTORY'
  | 'ETHICS'
  | 'ANTHROPOLOGY'

/** Prelims or Mains. Groups the chip rail and nothing else. */
export type Stage = 'PRELIMS' | 'MAINS'

/** Whether a subject is worked through as a lecture series or as a book. */
export type SourceKind = 'lectures' | 'book'

export type PyqWeight = 'high' | 'medium' | 'low' | 'none'

export type SubjectSummary = {
  subject: Subject
  label: string
  stage: Stage
  source_kind: SourceKind
  /** The book a `book` subject follows; empty for a lecture series. */
  source_name: string
  topics: number
}

export type TreeNode = {
  _id: string
  subject: Subject
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

export const getSubjects = () => api<SubjectSummary[]>('/syllabus/subjects')

export const getTree = (subject: Subject) =>
  api<TreeNode[]>(`/syllabus/tree?subject=${subject}`)

export const searchNodes = (q: string) =>
  api<TreeNode[]>(`/syllabus/search?q=${encodeURIComponent(q)}`)

export type NodeCreate = {
  subject: Subject
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

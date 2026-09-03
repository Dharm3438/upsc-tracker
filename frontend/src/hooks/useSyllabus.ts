import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import {
  archiveNode,
  createNode,
  getNode,
  getPapers,
  getTree,
  moveNode,
  searchNodes,
  updateNode,
  type NodeCreate,
  type NodePatch,
  type Paper,
} from '@/api/syllabus'

export function usePapers() {
  return useQuery({ queryKey: ['papers'], queryFn: getPapers })
}

export function useTree(paper: Paper) {
  return useQuery({
    queryKey: ['tree', paper],
    queryFn: () => getTree(paper),
    staleTime: 60_000,
  })
}

/** Full-text search over node paths. Debounce at the call site; this only
 *  caches what comes back. */
export function useNodeSearch(query: string) {
  return useQuery({
    queryKey: ['node-search', query],
    queryFn: () => searchNodes(query),
    enabled: query.length > 1,
    staleTime: 60_000,
  })
}

export function useNode(id: string | undefined) {
  return useQuery({
    queryKey: ['node', id],
    queryFn: () => getNode(id!),
    enabled: Boolean(id),
  })
}

/** Any write reshapes the tree, so refetch it rather than patching by hand. */
function useTreeInvalidation() {
  const client = useQueryClient()
  return () => {
    void client.invalidateQueries({ queryKey: ['tree'] })
    void client.invalidateQueries({ queryKey: ['papers'] })
    void client.invalidateQueries({ queryKey: ['node'] })
  }
}

export function useCreateNode() {
  const invalidate = useTreeInvalidation()
  return useMutation({ mutationFn: (body: NodeCreate) => createNode(body), onSuccess: invalidate })
}

export function useUpdateNode() {
  const invalidate = useTreeInvalidation()
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: NodePatch }) => updateNode(id, patch),
    onSuccess: invalidate,
  })
}

export function useMoveNode() {
  const invalidate = useTreeInvalidation()
  return useMutation({
    mutationFn: ({ id, parentId }: { id: string; parentId: string | null }) =>
      moveNode(id, { parent_id: parentId }),
    onSuccess: invalidate,
  })
}

export function useArchiveNode() {
  const invalidate = useTreeInvalidation()
  return useMutation({ mutationFn: (id: string) => archiveNode(id), onSuccess: invalidate })
}

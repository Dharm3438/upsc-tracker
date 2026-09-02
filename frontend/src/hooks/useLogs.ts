import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { createLog, deleteLog, getLogs, getRecentNodes, type NewLog } from '@/api/logs'

/**
 * A log changes the node's counts, its next-due date and therefore its row in
 * the tree and its place in the revision queue, so a write invalidates the lot
 * rather than trying to patch caches that the server has already recomputed.
 */
function useLogInvalidation() {
  const client = useQueryClient()
  return () => {
    void client.invalidateQueries({ queryKey: ['logs'] })
    void client.invalidateQueries({ queryKey: ['recent-nodes'] })
    void client.invalidateQueries({ queryKey: ['tree'] })
    void client.invalidateQueries({ queryKey: ['node'] })
    void client.invalidateQueries({ queryKey: ['due'] })
    void client.invalidateQueries({ queryKey: ['upcoming'] })
  }
}

export function useCreateLog() {
  const invalidate = useLogInvalidation()
  return useMutation({ mutationFn: (body: NewLog) => createLog(body), onSuccess: invalidate })
}

export function useDeleteLog() {
  const invalidate = useLogInvalidation()
  return useMutation({ mutationFn: (id: string) => deleteLog(id), onSuccess: invalidate })
}

export function useRecentNodes() {
  return useQuery({ queryKey: ['recent-nodes'], queryFn: getRecentNodes, staleTime: 30_000 })
}

/** A node's timeline, paged on the server's cursor. */
export function useNodeLogs(nodeId: string | undefined) {
  return useInfiniteQuery({
    queryKey: ['logs', nodeId],
    enabled: Boolean(nodeId),
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) => getLogs({ nodeId, limit: 20, cursor: pageParam }),
    getNextPageParam: (last) => last.next_cursor ?? undefined,
  })
}

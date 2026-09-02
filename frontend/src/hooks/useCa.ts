import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import {
  createCaItem,
  deleteCaItem,
  getCaInbox,
  getCaItems,
  getCaMonths,
  updateCaItem,
  type CaFilters,
  type NewCaItem,
} from '@/api/ca'

/**
 * Tagging an item moves it between two lists and writes a log on the node, so
 * every write invalidates all three. The months list goes too: the first item
 * of a new month has to make that month appear in the filter.
 */
function useCaInvalidation() {
  const client = useQueryClient()
  return () => {
    void client.invalidateQueries({ queryKey: ['ca'] })
    void client.invalidateQueries({ queryKey: ['ca-inbox'] })
    void client.invalidateQueries({ queryKey: ['ca-months'] })
    void client.invalidateQueries({ queryKey: ['logs'] })
  }
}

export function useCaItems(filters: CaFilters = {}) {
  return useInfiniteQuery({
    queryKey: ['ca', filters],
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) => getCaItems(filters, { cursor: pageParam, limit: 30 }),
    getNextPageParam: (last) => last.next_cursor ?? undefined,
  })
}

export function useCaInbox() {
  return useQuery({ queryKey: ['ca-inbox'], queryFn: getCaInbox })
}

export function useCaMonths() {
  return useQuery({ queryKey: ['ca-months'], queryFn: getCaMonths })
}

export function useCreateCaItem() {
  const invalidate = useCaInvalidation()
  return useMutation({
    mutationFn: (body: NewCaItem) => createCaItem(body),
    onSuccess: invalidate,
  })
}

export function useUpdateCaItem() {
  const invalidate = useCaInvalidation()
  return useMutation({
    mutationFn: ({ id, ...body }: Partial<NewCaItem> & { id: string }) =>
      updateCaItem(id, body),
    onSuccess: invalidate,
  })
}

export function useDeleteCaItem() {
  const invalidate = useCaInvalidation()
  return useMutation({
    mutationFn: (id: string) => deleteCaItem(id),
    onSuccess: invalidate,
  })
}

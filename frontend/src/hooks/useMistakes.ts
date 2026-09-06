import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query'

import {
  addTestMistakes,
  deleteMistake,
  getMistakes,
  updateMistake,
  type MistakeFilters,
  type MistakeItem,
} from '@/api/mistakes'

/** A test row carries its own mistake count, so it moves with the list. */
function useMistakeInvalidation() {
  const client = useQueryClient()
  return () => {
    void client.invalidateQueries({ queryKey: ['mistakes'] })
    void client.invalidateQueries({ queryKey: ['tests'] })
  }
}

export function useMistakes(filters: MistakeFilters) {
  return useInfiniteQuery({
    queryKey: ['mistakes', filters],
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) => getMistakes({ ...filters, cursor: pageParam }),
    getNextPageParam: (last) => last.next_cursor ?? undefined,
  })
}

export function useAddTestMistakes(testId: string) {
  const invalidate = useMistakeInvalidation()
  return useMutation({
    mutationFn: (items: MistakeItem[]) => addTestMistakes(testId, items),
    onSuccess: invalidate,
  })
}

export function useUpdateMistake() {
  const invalidate = useMistakeInvalidation()
  return useMutation({
    mutationFn: ({ id, ...body }: { id: string } & Parameters<typeof updateMistake>[1]) =>
      updateMistake(id, body),
    onSuccess: invalidate,
  })
}

export function useDeleteMistake() {
  const invalidate = useMistakeInvalidation()
  return useMutation({ mutationFn: (id: string) => deleteMistake(id), onSuccess: invalidate })
}

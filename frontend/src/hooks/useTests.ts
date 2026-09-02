import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import {
  createTest,
  deleteTest,
  getTest,
  getTests,
  updateTest,
  type NewTest,
} from '@/api/tests'

/** A written test moves the list, its trend, and the mistake counts beside it. */
function useTestInvalidation() {
  const client = useQueryClient()
  return () => {
    void client.invalidateQueries({ queryKey: ['tests'] })
    void client.invalidateQueries({ queryKey: ['mistakes'] })
  }
}

export function useTests() {
  return useInfiniteQuery({
    queryKey: ['tests'],
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) => getTests({ cursor: pageParam, limit: 20 }),
    getNextPageParam: (last) => last.next_cursor ?? undefined,
  })
}

export function useTest(id: string | undefined) {
  return useQuery({
    queryKey: ['tests', id],
    enabled: Boolean(id),
    queryFn: () => getTest(id as string),
  })
}

export function useCreateTest() {
  const invalidate = useTestInvalidation()
  return useMutation({ mutationFn: (body: NewTest) => createTest(body), onSuccess: invalidate })
}

export function useUpdateTest(id: string) {
  const invalidate = useTestInvalidation()
  return useMutation({
    mutationFn: (body: Partial<NewTest>) => updateTest(id, body),
    onSuccess: invalidate,
  })
}

export function useDeleteTest() {
  const invalidate = useTestInvalidation()
  return useMutation({ mutationFn: (id: string) => deleteTest(id), onSuccess: invalidate })
}

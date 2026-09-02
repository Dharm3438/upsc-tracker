import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import {
  createAnswer,
  deleteAnswer,
  getAnswer,
  getAnswers,
  getRedoQueue,
  updateAnswer,
  type NewAnswer,
} from '@/api/answers'

/** An answer moves its list, the redo queue, and the node timeline it logs to. */
function useAnswerInvalidation() {
  const client = useQueryClient()
  return () => {
    void client.invalidateQueries({ queryKey: ['answers'] })
    void client.invalidateQueries({ queryKey: ['redo-queue'] })
    void client.invalidateQueries({ queryKey: ['logs'] })
  }
}

export function useAnswers() {
  return useInfiniteQuery({
    queryKey: ['answers'],
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) => getAnswers({ cursor: pageParam, limit: 20 }),
    getNextPageParam: (last) => last.next_cursor ?? undefined,
  })
}

export function useAnswer(id: string | undefined) {
  return useQuery({
    queryKey: ['answers', id],
    enabled: Boolean(id),
    queryFn: () => getAnswer(id as string),
  })
}

/** Answers written on one study day — the Today row's count. */
export function useAnswersOn(day: string) {
  return useQuery({
    queryKey: ['answers', 'day', day],
    queryFn: () => getAnswers({ from: day, to: day, limit: 20 }),
  })
}

export function useRedoQueue() {
  return useQuery({ queryKey: ['redo-queue'], queryFn: getRedoQueue })
}

export function useCreateAnswer() {
  const invalidate = useAnswerInvalidation()
  return useMutation({
    mutationFn: (body: NewAnswer) => createAnswer(body),
    onSuccess: invalidate,
  })
}

export function useUpdateAnswer(id: string) {
  const invalidate = useAnswerInvalidation()
  return useMutation({
    mutationFn: (body: Parameters<typeof updateAnswer>[1]) => updateAnswer(id, body),
    onSuccess: invalidate,
  })
}

export function useDeleteAnswer() {
  const invalidate = useAnswerInvalidation()
  return useMutation({ mutationFn: (id: string) => deleteAnswer(id), onSuccess: invalidate })
}

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useQuery } from '@tanstack/react-query'

import { addTodo, deleteTodo, getWeek, updateTodo, type Week } from '@/api/week'

export function useWeek() {
  return useQuery({ queryKey: ['week'], queryFn: getWeek })
}

/** Every write answers with the whole week, so it seeds the cache instead of
 *  triggering a second fetch. */
function useWeekMutation<TArgs>(mutationFn: (args: TArgs) => Promise<Week>) {
  const client = useQueryClient()
  return useMutation({
    mutationFn,
    onSuccess: (week) => client.setQueryData(['week'], week),
  })
}

export function useAddTodo() {
  return useWeekMutation((body: { week_start?: string; text: string }) => addTodo(body))
}

export function useUpdateTodo() {
  return useWeekMutation(
    (args: { weekStart: string; todoId: string; text?: string; done?: boolean }) =>
      updateTodo(args.weekStart, args.todoId, { text: args.text, done: args.done }),
  )
}

export function useDeleteTodo() {
  return useWeekMutation((args: { weekStart: string; todoId: string }) =>
    deleteTodo(args.weekStart, args.todoId),
  )
}

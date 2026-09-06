import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { getWeek, saveWeekPlan, type WeekPlan } from '@/api/week'

export function useWeek() {
  return useQuery({ queryKey: ['week'], queryFn: getWeek })
}

/** The response is the whole week as it now stands, so it seeds the cache
 *  rather than triggering a second fetch. */
export function useSaveWeekPlan() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (body: WeekPlan) => saveWeekPlan(body),
    onSuccess: (week) => client.setQueryData(['week'], week),
  })
}

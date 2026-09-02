import { useQuery } from '@tanstack/react-query'

import { getDue, getUpcoming } from '@/api/review'

/**
 * The queue is computed from the study day, so it is stale the moment she
 * grades something — and `useLogs` invalidates it on every write. The short
 * stale time is only for coming back to the tab a few minutes later.
 */
export function useDue(limit?: number) {
  return useQuery({
    queryKey: ['due', limit ?? null],
    queryFn: () => getDue(limit),
    staleTime: 30_000,
  })
}

export function useUpcoming(days = 7) {
  return useQuery({
    queryKey: ['upcoming', days],
    queryFn: () => getUpcoming(days),
    staleTime: 60_000,
  })
}

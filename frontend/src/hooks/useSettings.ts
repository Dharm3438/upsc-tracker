import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import {
  createWeeklyReview,
  getSettings,
  getWeeklyReviews,
  updateSettings,
  type NewWeeklyReview,
  type SettingsPatch,
} from '@/api/settings'

export function useSettings() {
  return useQuery({ queryKey: ['settings'], queryFn: getSettings, staleTime: 30 * 60_000 })
}

/** Exam dates and off-days move every pace figure, so a change invalidates the
 *  whole Progress screen along with the countdown on Today. */
export function useUpdateSettings() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (body: SettingsPatch) => updateSettings(body),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ['settings'] })
      void client.invalidateQueries({ queryKey: ['countdown'] })
      void client.invalidateQueries({ queryKey: ['burndown'] })
      void client.invalidateQueries({ queryKey: ['effort'] })
    },
  })
}

export function useWeeklyReviews() {
  return useQuery({ queryKey: ['weekly-reviews'], queryFn: getWeeklyReviews })
}

export function useSaveWeeklyReview() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (body: NewWeeklyReview) => createWeeklyReview(body),
    onSuccess: () => client.invalidateQueries({ queryKey: ['weekly-reviews'] }),
  })
}

import { useQuery } from '@tanstack/react-query'

import {
  getBurndown,
  getCountdown,
  getCoverage,
  getEffort,
  getHeatmap,
} from '@/api/progress'
import type { Paper } from '@/api/syllabus'

/**
 * Progress is a weekly screen, not a daily one, and every figure on it is an
 * aggregation over the whole database. So these are cached for minutes rather
 * than seconds: a reading logged this morning moving the burn-down by a tenth
 * of a topic is not worth a refetch, and the numbers are read to see a trend.
 */
const STALE_MS = 5 * 60_000

export function useCountdown() {
  return useQuery({
    queryKey: ['countdown'],
    queryFn: getCountdown,
    // The countdown only changes at midnight, and it sits on Today as well.
    staleTime: 30 * 60_000,
  })
}

export function useBurndown() {
  return useQuery({ queryKey: ['burndown'], queryFn: getBurndown, staleTime: STALE_MS })
}

export function useCoverage() {
  return useQuery({ queryKey: ['coverage'], queryFn: getCoverage, staleTime: STALE_MS })
}

export function useHeatmap(paper?: Paper) {
  return useQuery({
    queryKey: ['heatmap', paper ?? null],
    queryFn: () => getHeatmap(paper),
    staleTime: STALE_MS,
  })
}

export function useEffort(days = 30) {
  return useQuery({
    queryKey: ['effort', days],
    queryFn: () => getEffort(days),
    staleTime: STALE_MS,
  })
}

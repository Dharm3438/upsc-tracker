import { useQuery } from '@tanstack/react-query'

import { getPapers, getTree, type Paper } from '@/api/syllabus'

export function usePapers() {
  return useQuery({ queryKey: ['papers'], queryFn: getPapers })
}

export function useTree(paper: Paper) {
  return useQuery({
    queryKey: ['tree', paper],
    queryFn: () => getTree(paper),
    staleTime: 60_000,
  })
}

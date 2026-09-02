import type { ReactNode } from 'react'

import { ErrorState } from './ErrorState'
import { SkeletonRows } from './Skeleton'

/**
 * The `isError -> no data -> empty -> content` ladder, written once. Eleven
 * screens had their own copy of it, and every one of them rendered "Loading…"
 * in the same component they used for "nothing here" and "that failed", so a
 * slow network was indistinguishable from a broken one.
 */
export function QueryBoundary<T>({
  query,
  skeleton,
  error,
  isEmpty,
  empty,
  children,
}: {
  query: { data: T | undefined; isError: boolean; refetch?: () => void }
  skeleton?: ReactNode
  error?: string
  isEmpty?: (data: T) => boolean
  empty?: ReactNode
  children: (data: T) => ReactNode
}) {
  if (query.isError) {
    return <ErrorState title={error ?? 'That did not load.'} onRetry={query.refetch} />
  }
  if (query.data === undefined) return <>{skeleton ?? <SkeletonRows />}</>
  if (isEmpty?.(query.data)) return <>{empty}</>
  return <>{children(query.data)}</>
}

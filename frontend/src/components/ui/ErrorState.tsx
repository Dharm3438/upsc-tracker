import { RefreshCw, TriangleAlert } from 'lucide-react'

import { Button } from './Button'

export function ErrorState({
  title = 'That did not load.',
  description,
  onRetry,
  size = 'md',
}: {
  title?: string
  description?: string
  onRetry?: () => void
  size?: 'sm' | 'md'
}) {
  return (
    <div
      className={`flex flex-col items-center justify-center px-6 text-center ${
        size === 'sm' ? 'py-8' : 'py-14'
      }`}
    >
      <span className="mb-3 rounded-full bg-danger-soft p-3 text-danger">
        <TriangleAlert size={20} strokeWidth={1.7} />
      </span>
      <p className="font-display text-base font-semibold text-ink">{title}</p>
      {description && <p className="mt-1.5 max-w-sm text-sm text-muted">{description}</p>}
      {onRetry && (
        <Button className="mt-4" size="sm" icon={<RefreshCw size={14} />} onClick={onRetry}>
          Try again
        </Button>
      )}
    </div>
  )
}

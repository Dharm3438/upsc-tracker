import { Compass } from 'lucide-react'

import { EmptyState } from '@/components/ui/EmptyState'
import { LinkButton } from '@/components/ui/Button'

export function NotFound() {
  return (
    <EmptyState
      icon={Compass}
      title="Nothing here."
      description="That address does not match a screen in this app."
      action={
        <LinkButton to="/" variant="primary">
          Back to Today
        </LinkButton>
      }
    />
  )
}

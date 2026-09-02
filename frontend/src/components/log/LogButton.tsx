import { useState } from 'react'

import { QuickLogSheet } from './QuickLogSheet'

/**
 * The floating action button, present on every screen (plan §8.3). Logging has
 * to be reachable from wherever she happens to be, not only from Today.
 */
export function LogButton() {
  const [open, setOpen] = useState(false)

  return (
    <>
      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-10 mx-auto max-w-md">
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Log something"
          className="pointer-events-auto absolute bottom-[calc(theme(spacing.tap)+16px+env(safe-area-inset-bottom))] right-4 h-14 w-14 rounded-full bg-signal text-2xl text-surface shadow-lg"
        >
          +
        </button>
      </div>
      {open && <QuickLogSheet onClose={() => setOpen(false)} />}
    </>
  )
}

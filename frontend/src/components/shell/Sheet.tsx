import { useEffect, useRef } from 'react'

/**
 * Bottom sheet. Motion only in response to a tap, and the global reduced-motion
 * rule turns the slide off for anyone who asked for that.
 */
export function Sheet({
  title,
  onClose,
  children,
}: {
  title: string
  onClose: () => void
  children: React.ReactNode
}) {
  const panel = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    // Move focus into the sheet so the keyboard lands somewhere sensible.
    panel.current?.querySelector<HTMLElement>('button, input, select, textarea')?.focus()
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="fixed inset-0 z-20 flex items-end justify-center">
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="absolute inset-0 bg-ink/30"
      />
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="relative w-full max-w-md rounded-t-xl bg-surface pb-[env(safe-area-inset-bottom)] motion-safe:animate-[slide-up_160ms_ease-out]"
      >
        <div className="flex min-h-tap items-center justify-between border-b border-line px-4">
          <h2 className="truncate pr-3 text-sm font-medium">{title}</h2>
          <button type="button" onClick={onClose} className="text-sm text-slate">
            Close
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

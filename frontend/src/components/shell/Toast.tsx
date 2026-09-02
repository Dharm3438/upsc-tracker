import { useEffect, useState } from 'react'

// A window event rather than a context: the toast is fired from mutation
// callbacks scattered across screens, and threading a provider through all of
// them buys nothing for one line of text.
const TOAST_EVENT = 'upsc:toast'
const VISIBLE_MS = 3200

export function toast(message: string): void {
  window.dispatchEvent(new CustomEvent(TOAST_EVENT, { detail: message }))
}

/** Mounted once by the shell. Confirms what was saved and then gets out of the way. */
export function Toaster() {
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    let timer: number
    function show(event: Event) {
      setMessage((event as CustomEvent<string>).detail)
      window.clearTimeout(timer)
      timer = window.setTimeout(() => setMessage(null), VISIBLE_MS)
    }
    window.addEventListener(TOAST_EVENT, show)
    return () => {
      window.removeEventListener(TOAST_EVENT, show)
      window.clearTimeout(timer)
    }
  }, [])

  if (!message) return null

  return (
    <div
      // Announced, but never stealing focus from whatever she does next.
      role="status"
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 bottom-[calc(theme(spacing.tap)+12px)] z-30 flex justify-center px-4"
    >
      <p className="max-w-md rounded-lg bg-ink px-4 py-2 text-sm text-paper shadow-lg motion-safe:animate-[slide-up_160ms_ease-out]">
        {message}
      </p>
    </div>
  )
}

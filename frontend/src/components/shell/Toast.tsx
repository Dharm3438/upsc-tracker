import { useEffect, useState } from 'react'
import { CircleCheck, TriangleAlert } from 'lucide-react'

// A window event rather than a context: the toast is fired from mutation
// callbacks scattered across screens, and threading a provider through all of
// them buys nothing for one line of text.
const TOAST_EVENT = 'upsc:toast'
const VISIBLE_MS = 3200

type Tone = 'ok' | 'error'
type Payload = { message: string; tone: Tone }

export function toast(message: string, tone: Tone = 'ok'): void {
  window.dispatchEvent(new CustomEvent<Payload>(TOAST_EVENT, { detail: { message, tone } }))
}

/** Mounted once by the shell. Confirms what was saved and then gets out of the
 *  way. Bottom-centre above the tab bar on a phone; top-right under the nav on a
 *  desktop, where the eye is already looking after clicking something. */
export function Toaster() {
  const [payload, setPayload] = useState<Payload | null>(null)

  useEffect(() => {
    let timer: number
    function show(event: Event) {
      setPayload((event as CustomEvent<Payload>).detail)
      window.clearTimeout(timer)
      timer = window.setTimeout(() => setPayload(null), VISIBLE_MS)
    }
    window.addEventListener(TOAST_EVENT, show)
    return () => {
      window.removeEventListener(TOAST_EVENT, show)
      window.clearTimeout(timer)
    }
  }, [])

  if (!payload) return null
  const Icon = payload.tone === 'error' ? TriangleAlert : CircleCheck

  return (
    <div
      // Announced, but never stealing focus from whatever she does next.
      role="status"
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 bottom-[calc(theme(spacing.navbar)+12px+env(safe-area-inset-bottom))] z-40 flex justify-center px-4 sm:inset-x-auto sm:bottom-auto sm:right-6 sm:top-[calc(theme(spacing.topnav)+16px)] sm:justify-end"
    >
      <p
        className={`flex max-w-sm items-start gap-2.5 rounded-lg border bg-surface px-3.5 py-2.5 text-sm shadow-pop motion-safe:animate-[slide-up_180ms_ease-out] sm:motion-safe:animate-[fade-scale_150ms_ease-out] ${
          payload.tone === 'error' ? 'border-danger/25' : 'border-hairline'
        }`}
      >
        <Icon
          size={16}
          strokeWidth={1.9}
          className={`mt-0.5 shrink-0 ${payload.tone === 'error' ? 'text-danger' : 'text-success'}`}
        />
        <span className="text-ink">{payload.message}</span>
      </p>
    </div>
  )
}

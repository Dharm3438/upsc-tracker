import { useEffect, useRef } from 'react'
import type { ReactNode, RefObject } from 'react'
import { X } from 'lucide-react'

import { cn } from '@/lib/cn'

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

const SIZE = {
  sm: 'sm:max-w-md',
  md: 'sm:max-w-xl',
  lg: 'sm:max-w-3xl',
} as const

/**
 * One dialog, two form factors: a bottom sheet on a phone, a centred modal from
 * `sm` up. Everything modal in the app composes this — the quick log, grading,
 * tests, current affairs, the node menu — so the breakpoint behaviour is
 * decided here once.
 *
 * Motion only in response to a tap, and the global reduced-motion rule turns
 * both animations off for anyone who asked for that.
 */
export function Sheet({
  title,
  description,
  size = 'md',
  footer,
  initialFocus,
  onClose,
  children,
}: {
  title: string
  description?: string
  size?: keyof typeof SIZE
  footer?: ReactNode
  /** Where the keyboard should land. Without it focus goes to the first
   *  control in the body — never the close button, which is first in the DOM. */
  initialFocus?: RefObject<HTMLElement>
  onClose: () => void
  children: ReactNode
}) {
  const panel = useRef<HTMLDivElement>(null)
  const body = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null

    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        onClose()
        return
      }
      if (event.key !== 'Tab' || !panel.current) return

      // Keep Tab inside the dialog. Without this the focus ring walks off into
      // the page behind the backdrop, which is unreachable by pointer.
      const items = Array.from(panel.current.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
        (item) => item.offsetParent !== null,
      )
      if (items.length === 0) return
      const first = items[0]
      const last = items[items.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', onKey)

    // Lock the page, not the panel: the panel and the search results inside
    // NodePicker both need to keep scrolling.
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    const target =
      initialFocus?.current ??
      body.current?.querySelector<HTMLElement>(FOCUSABLE) ??
      panel.current
    target?.focus()

    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = previousOverflow
      opener?.focus?.()
    }
  }, [onClose, initialFocus])

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-6">
      <button
        type="button"
        tabIndex={-1}
        aria-hidden
        onClick={onClose}
        className="absolute inset-0 bg-navy-deep/45 backdrop-blur-[2px] motion-safe:animate-[fade-in_120ms_ease-out]"
      />

      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        className={cn(
          'relative flex max-h-[88dvh] w-full flex-col overflow-hidden bg-surface shadow-pop outline-none',
          'rounded-t-2xl pb-[env(safe-area-inset-bottom)]',
          'sm:max-h-[85dvh] sm:rounded-xl sm:border sm:border-hairline sm:pb-0',
          SIZE[size],
          'motion-safe:animate-[slide-up_180ms_cubic-bezier(0.22,1,0.36,1)]',
          'sm:motion-safe:animate-[fade-scale_150ms_cubic-bezier(0.22,1,0.36,1)]',
        )}
      >
        {/* Decorative grab handle; the sheet is not draggable, but the affordance
            tells a thumb where the top of the panel is. */}
        <div aria-hidden className="mx-auto mt-2 h-1 w-9 rounded-full bg-hairline sm:hidden" />

        <div className="flex min-h-[52px] items-start justify-between gap-3 border-b border-hairline px-4 py-3 sm:px-5">
          <div className="min-w-0 pt-0.5">
            <h2 className="truncate font-display text-lg font-semibold leading-tight text-ink">
              {title}
            </h2>
            {description && <p className="truncate pt-0.5 text-xs text-muted">{description}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="-mr-1 shrink-0 rounded-md p-2 text-muted transition-colors hover:bg-hairline/60 hover:text-ink"
          >
            <X size={17} strokeWidth={2} />
          </button>
        </div>

        <div ref={body} className="scroll-thin min-h-0 flex-1 overflow-y-auto">
          {children}
        </div>

        {footer && (
          <div className="border-t border-hairline bg-surface px-4 py-3 sm:px-5">{footer}</div>
        )}
      </div>
    </div>
  )
}

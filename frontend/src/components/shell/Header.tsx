import { formatDayIST } from '@/lib/date'

export function Header({ title }: { title?: string }) {
  return (
    <header className="flex h-tap items-center justify-between px-4">
      <h1 className="text-base font-medium">{title ?? formatDayIST(new Date())}</h1>
      <button
        type="button"
        aria-label="Settings"
        className="flex h-tap w-tap items-center justify-center text-slate"
      >
        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.6">
          <circle cx="12" cy="12" r="3.2" />
          <path d="M12 2.8v2.4M12 18.8v2.4M4.3 7.5l2.1 1.2M17.6 15.3l2.1 1.2M4.3 16.5l2.1-1.2M17.6 8.7l2.1-1.2" />
        </svg>
      </button>
    </header>
  )
}

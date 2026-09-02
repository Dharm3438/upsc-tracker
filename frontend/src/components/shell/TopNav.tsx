import { useQuery } from '@tanstack/react-query'
import {
  LayoutDashboard,
  ListTree,
  Lock,
  NotebookPen,
  PenLine,
  Plus,
  Settings,
  TrendingUp,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { Link, NavLink } from 'react-router-dom'

import { UNAUTHORIZED_EVENT, clearApiKey, getHealth } from '@/api/client'
import { Button } from '@/components/ui/Button'
import { Tooltip } from '@/components/ui/Tooltip'
import { cn } from '@/lib/cn'
import { formatDayIST } from '@/lib/date'
import { useCaInbox } from '@/hooks/useCa'
import { useDue } from '@/hooks/useReview'

export const NAV: { to: string; label: string; icon: LucideIcon; end?: boolean }[] = [
  { to: '/', label: 'Today', icon: LayoutDashboard, end: true },
  { to: '/syllabus', label: 'Syllabus', icon: ListTree },
  { to: '/practice', label: 'Practice', icon: PenLine },
  { to: '/notes', label: 'Notes', icon: NotebookPen },
  { to: '/progress', label: 'Progress', icon: TrendingUp },
]

export function TopNav({ onLog }: { onLog: () => void }) {
  const due = useDue()
  const inbox = useCaInbox()

  const badges: Record<string, number | undefined> = {
    '/': due.data?.total,
    '/notes': inbox.data?.total,
  }

  return (
    <header className="sticky top-0 z-30 bg-navy text-white shadow-nav">
      <div className="mx-auto flex h-topnav max-w-shell items-center gap-3 px-4 sm:px-6 lg:gap-6 lg:px-8">
        <Link to="/" className="flex shrink-0 items-baseline gap-1.5">
          <span className="font-display text-lg font-semibold tracking-tight text-accent-ring">
            UPSC
          </span>
          <span className="hidden text-sm text-white/50 sm:inline">Tracker</span>
        </Link>

        <nav aria-label="Sections" className="hidden lg:flex lg:h-full lg:items-stretch">
          <ul className="flex h-full items-stretch">
            {NAV.map((item) => (
              <li key={item.to} className="flex">
                <NavLink
                  to={item.to}
                  end={item.end}
                  className={({ isActive }) =>
                    cn(
                      'relative flex items-center gap-2 px-3.5 text-sm font-medium transition-colors',
                      'after:absolute after:inset-x-2.5 after:bottom-0 after:h-0.5 after:rounded-t-full',
                      isActive
                        ? 'text-white after:bg-accent-ring'
                        : 'text-white/60 hover:text-white after:bg-transparent',
                    )
                  }
                >
                  <item.icon size={16} strokeWidth={1.9} />
                  {item.label}
                  <NavCount value={badges[item.to]} />
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>

        <div className="ml-auto flex shrink-0 items-center gap-1.5 sm:gap-2">
          <span className="hidden text-sm tabular-nums text-white/55 md:inline">
            {formatDayIST(new Date())}
          </span>
          <HealthDot />
          <Button
            variant="primary"
            size="sm"
            icon={<Plus size={15} strokeWidth={2.2} />}
            onClick={onLog}
            className="hidden lg:inline-flex"
          >
            Log
          </Button>
          <IconLink to="/settings" label="Settings" icon={Settings} />
          <IconButton
            label="Lock this device"
            icon={Lock}
            onClick={() => {
              clearApiKey()
              window.dispatchEvent(new Event(UNAUTHORIZED_EVENT))
            }}
          />
        </div>
      </div>
    </header>
  )
}

function NavCount({ value }: { value?: number }) {
  if (!value) return null
  return (
    <span className="rounded-full bg-white/15 px-1.5 text-[11px] tabular-nums text-white/80">
      {value}
    </span>
  )
}

/** The database health poll used to live on the Today screen. It belongs in the
 *  chrome: a database that is down is not a fact about today. */
function HealthDot() {
  const health = useQuery({ queryKey: ['health'], queryFn: getHealth, refetchInterval: 60_000 })
  if (!health.data) return null
  const ok = health.data.mongo

  return (
    <Tooltip label={ok ? 'Database reachable' : 'Database unreachable'}>
      <span
        role="status"
        aria-label={ok ? 'Database reachable' : 'Database unreachable'}
        className={cn(
          'mx-1 block h-2 w-2 rounded-full',
          ok ? 'bg-success-soft/70' : 'bg-accent-ring',
        )}
      />
    </Tooltip>
  )
}

const ICON_BUTTON =
  'flex h-9 w-9 items-center justify-center rounded-md text-white/60 transition-colors hover:bg-white/10 hover:text-white'

function IconLink({ to, label, icon: Icon }: { to: string; label: string; icon: LucideIcon }) {
  return (
    <Tooltip label={label}>
      <Link to={to} aria-label={label} className={ICON_BUTTON}>
        <Icon size={17} strokeWidth={1.8} />
      </Link>
    </Tooltip>
  )
}

function IconButton({
  label,
  icon: Icon,
  onClick,
}: {
  label: string
  icon: LucideIcon
  onClick: () => void
}) {
  return (
    <Tooltip label={label}>
      <button type="button" aria-label={label} onClick={onClick} className={ICON_BUTTON}>
        <Icon size={17} strokeWidth={1.8} />
      </button>
    </Tooltip>
  )
}

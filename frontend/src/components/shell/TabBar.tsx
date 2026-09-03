import { NavLink } from 'react-router-dom'

import { cn } from '@/lib/cn'
import { NAV } from './TopNav'

/**
 * Phone navigation. The five sections are all top-level and equally used, so a
 * bottom bar beats a drawer: it costs no taps and sits under the thumb. Hidden
 * from `lg` up, where TopNav carries the same five links.
 */
export function TabBar() {
  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-30 border-t border-hairline bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden"
      aria-label="Sections"
    >
      <ul className="flex">
        {NAV.map((tab) => (
          <li key={tab.to} className="flex-1">
            <NavLink
              to={tab.to}
              end={tab.end}
              className={({ isActive }) =>
                cn(
                  'relative flex h-navbar flex-col items-center justify-center gap-1 transition-colors',
                  'before:absolute before:inset-x-6 before:top-0 before:h-0.5 before:rounded-b-full',
                  isActive
                    ? 'text-accent before:bg-accent'
                    : 'text-muted before:bg-transparent',
                )
              }
            >
              <tab.icon size={19} strokeWidth={1.9} />
              <span className="text-[11px] font-medium leading-none">{tab.label}</span>
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  )
}

import { NavLink } from 'react-router-dom'

const TABS = [
  { to: '/', label: 'Today', end: true },
  { to: '/syllabus', label: 'Syllabus' },
  { to: '/practice', label: 'Practice' },
  { to: '/notes', label: 'Notes' },
  { to: '/progress', label: 'Progress' },
]

export function TabBar() {
  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-10 border-t border-line bg-surface pb-[env(safe-area-inset-bottom)]"
      aria-label="Sections"
    >
      <ul className="mx-auto flex max-w-md">
        {TABS.map((tab) => (
          <li key={tab.to} className="flex-1">
            <NavLink
              to={tab.to}
              end={tab.end}
              className={({ isActive }) =>
                [
                  'flex h-tap items-center justify-center text-sm',
                  isActive ? 'font-medium text-signal' : 'text-slate',
                ].join(' ')
              }
            >
              {tab.label}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  )
}

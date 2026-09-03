import { useQuery } from '@tanstack/react-query'
import { Plus, TriangleAlert } from 'lucide-react'
import { Link, Outlet } from 'react-router-dom'

import { getHealth } from '@/api/client'
import { Callout } from '@/components/ui/Callout'
import { TabBar } from './TabBar'
import { Toaster } from './Toast'
import { TopNav } from './TopNav'

/**
 * The shell every screen renders inside. Both entry points to logging lead to
 * the syllabus: a log belongs to a topic, and the topic page is where one is
 * already in hand.
 */
export function AppLayout() {
  const health = useQuery({ queryKey: ['health'], queryFn: getHealth, refetchInterval: 60_000 })
  const degraded = health.data && !health.data.mongo

  return (
    <div className="min-h-dvh">
      <TopNav />

      <main className="mx-auto w-full max-w-shell px-4 pb-[calc(theme(spacing.navbar)+env(safe-area-inset-bottom)+24px)] pt-5 sm:px-6 lg:px-8 lg:pb-14 lg:pt-8">
        {degraded && (
          <Callout tone="danger" icon={TriangleAlert} className="mb-5">
            The server cannot reach the database. Nothing will save until it can.
          </Callout>
        )}
        <Outlet />
      </main>

      <TabBar />

      {/* The desktop entry point lives in the nav; this is the thumb-reach one. */}
      <Link
        to="/syllabus"
        aria-label="Log something"
        className="fixed bottom-[calc(theme(spacing.navbar)+16px+env(safe-area-inset-bottom))] right-4 z-30 flex h-14 w-14 items-center justify-center rounded-full bg-accent text-white shadow-pop transition-colors hover:bg-accent-hover lg:hidden"
      >
        <Plus size={24} strokeWidth={2.2} />
      </Link>

      <Toaster />
    </div>
  )
}

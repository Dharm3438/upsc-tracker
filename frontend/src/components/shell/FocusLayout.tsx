import { Outlet } from 'react-router-dom'

import { Toaster } from './Toast'

/**
 * No nav, no tab bar, no floating button. The answer timer is a fifteen-minute
 * focus mode and every piece of surrounding chrome is an invitation to leave it.
 */
export function FocusLayout() {
  return (
    <div className="min-h-dvh">
      <main className="mx-auto w-full max-w-shell px-4 py-5 sm:px-6 lg:px-8 lg:py-8">
        <Outlet />
      </main>
      <Toaster />
    </div>
  )
}

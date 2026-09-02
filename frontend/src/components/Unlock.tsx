import { useState, type FormEvent } from 'react'

import { setApiKey, verifyKey } from '@/api/client'

/** One field, no accounts. The key is the whole of auth (plan §6). */
export function Unlock({ onUnlocked }: { onUnlocked: () => void }) {
  const [key, setKey] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [checking, setChecking] = useState(false)

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (!key.trim()) return
    setChecking(true)
    setError(null)
    try {
      if (await verifyKey(key.trim())) {
        setApiKey(key.trim())
        onUnlocked()
      } else {
        setError('That key was not accepted.')
      }
    } catch {
      setError('Could not reach the server.')
    } finally {
      setChecking(false)
    }
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-6">
      <h1 className="text-xl font-semibold">UPSC Tracker</h1>
      <p className="mt-2 text-sm text-slate">Enter your key to unlock this device.</p>

      <form onSubmit={submit} className="mt-8">
        <label htmlFor="key" className="text-sm text-slate">
          API key
        </label>
        <input
          id="key"
          type="password"
          value={key}
          autoComplete="off"
          onChange={(event) => setKey(event.target.value)}
          className="mt-2 h-tap w-full rounded border border-line bg-surface px-3 text-base focus:border-signal"
        />
        {error && <p className="mt-2 text-sm text-overdue">{error}</p>}
        <button
          type="submit"
          disabled={checking || !key.trim()}
          className="mt-6 h-tap w-full rounded bg-signal text-base font-medium text-white disabled:opacity-40"
        >
          {checking ? 'Checking…' : 'Unlock'}
        </button>
      </form>
    </main>
  )
}

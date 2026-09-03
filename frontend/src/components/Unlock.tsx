import { useState, type FormEvent } from 'react'
import { Eye, EyeOff, Lock } from 'lucide-react'

import { setApiKey, verifyKey } from '@/api/client'
import { Button, Callout, Field, Input } from '@/components/ui'

/** One field, no accounts. The key is the whole of auth. */
export function Unlock({ onUnlocked }: { onUnlocked: () => void }) {
  const [key, setKey] = useState('')
  const [reveal, setReveal] = useState(false)
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
    <div className="min-h-dvh lg:grid lg:grid-cols-2">
      {/* The masthead half. Hidden on a phone, where it would only push the one
          field that matters below the fold. */}
      <aside className="relative hidden overflow-hidden bg-navy p-12 text-white lg:flex lg:flex-col lg:justify-between">
        <div
          aria-hidden
          className="pointer-events-none absolute -left-24 top-1/3 h-96 w-96 rounded-full bg-accent/20 blur-3xl"
        />
        <p className="relative flex items-baseline gap-2">
          <span className="font-display text-2xl font-semibold text-accent-ring">UPSC</span>
          <span className="text-lg text-white/50">Tracker</span>
        </p>
        <div className="relative max-w-md">
          <h1 className="font-display text-4xl font-semibold leading-tight">
            Two years, one syllabus, and an honest count of what is left.
          </h1>
          <p className="mt-4 text-base leading-relaxed text-white/60">
            Spaced revision, answer practice, the mistake notebook and a pace that takes your
            off-days out of the arithmetic rather than calling them a broken streak.
          </p>
        </div>
        <p className="relative text-sm text-white/35">GS 1–4 · CSAT · Essay · Anthropology</p>
      </aside>

      <main className="flex min-h-dvh flex-col justify-center px-6 py-12 lg:min-h-0 lg:px-16">
        <div className="mx-auto w-full max-w-sm">
          <span className="mb-5 inline-flex rounded-full bg-accent-soft p-3 text-accent">
            <Lock size={20} strokeWidth={1.8} />
          </span>
          <h2 className="font-display text-2xl font-semibold text-ink lg:hidden">UPSC Tracker</h2>
          <h2 className="hidden font-display text-2xl font-semibold text-ink lg:block">
            Unlock this device
          </h2>
          <p className="mt-2 text-sm text-muted">
            The key is kept in this browser and cleared automatically if the server rejects it.
          </p>

          <form onSubmit={submit} className="mt-8 space-y-4">
            <Field label="API key" htmlFor="key">
              <div className="relative">
                <Input
                  id="key"
                  type={reveal ? 'text' : 'password'}
                  value={key}
                  autoComplete="off"
                  autoFocus
                  onChange={(event) => setKey(event.target.value)}
                  className="h-tap pr-11 text-base"
                />
                <button
                  type="button"
                  onClick={() => setReveal(!reveal)}
                  aria-label={reveal ? 'Hide the key' : 'Show the key'}
                  className="absolute right-1 top-1/2 -translate-y-1/2 rounded-md p-2 text-faint transition-colors hover:text-ink"
                >
                  {reveal ? <EyeOff size={16} strokeWidth={1.9} /> : <Eye size={16} strokeWidth={1.9} />}
                </button>
              </div>
            </Field>

            {error && <Callout tone="danger">{error}</Callout>}

            <Button
              type="submit"
              variant="primary"
              size="lg"
              full
              loading={checking}
              disabled={!key.trim()}
            >
              Unlock
            </Button>
          </form>
        </div>
      </main>
    </div>
  )
}

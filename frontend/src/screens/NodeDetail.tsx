import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'

import { EmptyState } from '@/components/EmptyState'
import { useNode, useUpdateNode } from '@/hooks/useSyllabus'

export function NodeDetail() {
  const { nodeId } = useParams()
  const navigate = useNavigate()
  const node = useNode(nodeId)

  if (node.isError) return <EmptyState>Could not load that topic.</EmptyState>
  if (!node.data) return <EmptyState>Loading…</EmptyState>

  const crumbs = node.data.path.split('/')

  return (
    <>
      <header className="flex min-h-tap items-center gap-2 px-4">
        <button type="button" onClick={() => navigate(-1)} className="text-sm text-signal">
          ‹ Back
        </button>
      </header>

      <div className="px-4 pb-4">
        <p className="text-xs text-slate">{crumbs.slice(0, -1).join(' › ')}</p>
        <h1 className="mt-1 text-lg font-medium">{node.data.title}</h1>
        <p className="mt-2 text-sm text-slate">
          PYQ weight: {node.data.pyq_weight}
          {node.data.needs_diagram && ' · diagram carries marks here'}
          {node.data.is_custom && ' · your own topic'}
        </p>
      </div>

      <Section label="Revision">
        <Row label="Confidence" value="not started" />
        <Row label="Next due" value={node.data.next_due ?? '—'} />
      </Section>

      <Section label="Your notes">
        <Notes nodeId={node.data._id} initial={node.data.notes} />
      </Section>

      <Section label="Timeline">
        <EmptyState>Not started. Log a reading to begin tracking it.</EmptyState>
      </Section>
    </>
  )
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <section className="mt-6">
      <h2 className="px-4 pb-2 text-xs uppercase tracking-wide text-slate">{label}</h2>
      <div className="border-y border-line bg-surface">{children}</div>
    </section>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex min-h-tap items-center justify-between px-4">
      <span className="text-sm">{label}</span>
      <span className="text-sm text-slate">{value}</span>
    </div>
  )
}

/** Autosaving textarea: a save button here would cost a tap she would forget. */
function Notes({ nodeId, initial }: { nodeId: string; initial: string }) {
  const [text, setText] = useState(initial)
  const [saved, setSaved] = useState(true)
  const update = useUpdateNode()
  const timer = useRef<number>()

  useEffect(() => {
    setText(initial)
    setSaved(true)
  }, [initial, nodeId])

  useEffect(() => () => window.clearTimeout(timer.current), [])

  function change(value: string) {
    setText(value)
    setSaved(false)
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => {
      update.mutate({ id: nodeId, patch: { notes: value } }, { onSuccess: () => setSaved(true) })
    }, 800)
  }

  return (
    <div className="p-4">
      <textarea
        value={text}
        onChange={(event) => change(event.target.value)}
        rows={4}
        placeholder="Anything worth remembering about this topic."
        className="w-full resize-y rounded border border-line bg-surface p-3 text-sm focus:border-signal"
      />
      <p className="mt-1 text-xs text-slate">{saved ? 'Saved' : 'Saving…'}</p>
    </div>
  )
}

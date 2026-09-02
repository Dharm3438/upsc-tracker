import { useState } from 'react'

import type { PyqWeight, TreeNode } from '@/api/syllabus'
import { Sheet } from '@/components/shell/Sheet'
import {
  useArchiveNode,
  useCreateNode,
  useMoveNode,
  useUpdateNode,
} from '@/hooks/useSyllabus'

type Mode = 'menu' | 'rename' | 'add' | 'move' | 'archive'

const WEIGHTS: PyqWeight[] = ['high', 'medium', 'low', 'none']

/**
 * The long-press menu: edit, add a child, move, archive. Every action reports
 * the server's own message on failure — the API is where the rules live (three
 * levels deep, no duplicate siblings, no archiving a node with children), so
 * repeating them in the UI would only let the two drift apart.
 */
export function NodeActions({
  node,
  candidates,
  onClose,
}: {
  node: TreeNode
  /** Nodes in this paper that could take `node` as a child. */
  candidates: TreeNode[]
  onClose: () => void
}) {
  const [mode, setMode] = useState<Mode>('menu')
  const [error, setError] = useState<string | null>(null)

  const update = useUpdateNode()
  const create = useCreateNode()
  const move = useMoveNode()
  const archive = useArchiveNode()

  async function run(action: () => Promise<unknown>) {
    setError(null)
    try {
      await action()
      onClose()
    } catch (failure) {
      setError(readDetail(failure))
    }
  }

  return (
    <Sheet title={node.title} onClose={onClose}>
      {error && <p className="px-4 pt-3 text-sm text-overdue">{error}</p>}

      {mode === 'menu' && (
        <ul className="py-1">
          <MenuItem label="Edit title, weight and diagram flag" onClick={() => setMode('rename')} />
          {node.level < 3 && <MenuItem label="Add a child topic" onClick={() => setMode('add')} />}
          <MenuItem label="Move" onClick={() => setMode('move')} />
          <MenuItem label="Archive" onClick={() => setMode('archive')} />
        </ul>
      )}

      {mode === 'rename' && (
        <EditForm
          node={node}
          busy={update.isPending}
          onSubmit={(title, weight, diagram) =>
            run(() =>
              update.mutateAsync({
                id: node._id,
                patch: { title, pyq_weight: weight, needs_diagram: diagram },
              }),
            )
          }
        />
      )}

      {mode === 'add' && (
        <EditForm
          busy={create.isPending}
          submitLabel="Add topic"
          onSubmit={(title, weight, diagram) =>
            run(() =>
              create.mutateAsync({
                paper: node.paper,
                parent_id: node._id,
                title,
                pyq_weight: weight,
                needs_diagram: diagram,
              }),
            )
          }
        />
      )}

      {mode === 'move' && (
        <MoveForm
          node={node}
          candidates={candidates}
          busy={move.isPending}
          onSubmit={(parentId) => run(() => move.mutateAsync({ id: node._id, parentId }))}
        />
      )}

      {mode === 'archive' && (
        <div className="p-4">
          <p className="text-sm">
            Archive “{node.title}”? It disappears from the tree but nothing logged against
            it is deleted.
          </p>
          <button
            type="button"
            disabled={archive.isPending}
            onClick={() => run(() => archive.mutateAsync(node._id))}
            className="mt-4 h-tap w-full rounded bg-overdue text-base font-medium text-white disabled:opacity-40"
          >
            Archive it
          </button>
        </div>
      )}
    </Sheet>
  )
}

function MenuItem({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        className="flex min-h-tap w-full items-center px-4 text-left text-sm"
      >
        {label}
      </button>
    </li>
  )
}

function EditForm({
  node,
  busy,
  submitLabel = 'Save changes',
  onSubmit,
}: {
  node?: TreeNode
  busy: boolean
  submitLabel?: string
  onSubmit: (title: string, weight: PyqWeight, diagram: boolean) => void
}) {
  const [title, setTitle] = useState(node?.title ?? '')
  const [weight, setWeight] = useState<PyqWeight>(node?.pyq_weight ?? 'medium')
  const [diagram, setDiagram] = useState(node?.needs_diagram ?? false)

  return (
    <form
      className="p-4"
      onSubmit={(event) => {
        event.preventDefault()
        if (title.trim()) onSubmit(title.trim(), weight, diagram)
      }}
    >
      <label htmlFor="node-title" className="text-sm text-slate">
        Title
      </label>
      <input
        id="node-title"
        value={title}
        onChange={(event) => setTitle(event.target.value)}
        className="mt-1 h-tap w-full rounded border border-line px-3 text-base focus:border-signal"
      />

      <p className="mt-4 text-sm text-slate">PYQ weight</p>
      <div className="mt-1 flex gap-2">
        {WEIGHTS.map((option) => (
          <button
            key={option}
            type="button"
            aria-pressed={weight === option}
            onClick={() => setWeight(option)}
            className={[
              'h-tap flex-1 rounded border text-sm',
              weight === option ? 'border-signal text-signal' : 'border-line text-slate',
            ].join(' ')}
          >
            {option}
          </button>
        ))}
      </div>

      <label className="mt-4 flex min-h-tap items-center gap-3 text-sm">
        <input
          type="checkbox"
          checked={diagram}
          onChange={(event) => setDiagram(event.target.checked)}
          className="h-5 w-5 accent-signal"
        />
        Diagram carries marks here
      </label>

      <button
        type="submit"
        disabled={busy || !title.trim()}
        className="mt-4 h-tap w-full rounded bg-signal text-base font-medium text-white disabled:opacity-40"
      >
        {submitLabel}
      </button>
    </form>
  )
}

function MoveForm({
  node,
  candidates,
  busy,
  onSubmit,
}: {
  node: TreeNode
  candidates: TreeNode[]
  busy: boolean
  onSubmit: (parentId: string | null) => void
}) {
  const [parentId, setParentId] = useState<string>(node.parent_id ?? '')

  return (
    <form
      className="p-4"
      onSubmit={(event) => {
        event.preventDefault()
        onSubmit(parentId || null)
      }}
    >
      <label htmlFor="new-parent" className="text-sm text-slate">
        Move under
      </label>
      <select
        id="new-parent"
        value={parentId}
        onChange={(event) => setParentId(event.target.value)}
        className="mt-1 h-tap w-full rounded border border-line bg-surface px-2 text-sm focus:border-signal"
      >
        <option value="">{node.paper} — top level</option>
        {candidates.map((candidate) => (
          <option key={candidate._id} value={candidate._id}>
            {candidate.path.split('/').slice(1).join(' › ')}
          </option>
        ))}
      </select>

      <button
        type="submit"
        disabled={busy}
        className="mt-4 h-tap w-full rounded bg-signal text-base font-medium text-white disabled:opacity-40"
      >
        Move it
      </button>
    </form>
  )
}

/** FastAPI puts the human-readable reason in `detail`. */
function readDetail(failure: unknown): string {
  const raw = failure instanceof Error ? failure.message : String(failure)
  try {
    const parsed = JSON.parse(raw)
    if (typeof parsed?.detail === 'string') return parsed.detail
  } catch {
    // Not JSON — fall through to the raw message.
  }
  return raw || 'That did not work.'
}

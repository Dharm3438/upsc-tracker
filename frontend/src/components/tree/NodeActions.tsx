import { useState } from 'react'

import type { PyqWeight, TreeNode } from '@/api/syllabus'
import { ChevronRight } from 'lucide-react'

import { Sheet } from '@/components/shell/Sheet'
import { Button, Callout, Chip, Field, Input, Select } from '@/components/ui'
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
    <Sheet
      title={node.title}
      description={mode === 'menu' ? node.path.split('/').slice(0, -1).join(' › ') : undefined}
      size="sm"
      onClose={onClose}
    >
      {error && (
        <div className="p-4 pb-0 sm:p-5 sm:pb-0">
          <Callout tone="danger">{error}</Callout>
        </div>
      )}

      {mode === 'menu' && (
        <ul className="divide-y divide-hairline">
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
        <div className="p-4 sm:p-5">
          <p className="text-sm text-ink">
            Archive “{node.title}”? It disappears from the tree but nothing logged against
            it is deleted.
          </p>
          <Button
            variant="danger"
            size="lg"
            full
            className="mt-4"
            loading={archive.isPending}
            onClick={() => run(() => archive.mutateAsync(node._id))}
          >
            Archive it
          </Button>
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
        className="flex min-h-tap w-full items-center justify-between gap-3 px-4 text-left text-sm text-ink transition-colors hover:bg-canvas sm:px-5"
      >
        {label}
        <ChevronRight size={15} strokeWidth={2} className="shrink-0 text-faint" aria-hidden />
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
      className="space-y-4 p-4 sm:p-5"
      onSubmit={(event) => {
        event.preventDefault()
        if (title.trim()) onSubmit(title.trim(), weight, diagram)
      }}
    >
      <Field label="Title" htmlFor="node-title">
        <Input
          id="node-title"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
        />
      </Field>

      <Field label="PYQ weight">
        <div className="flex flex-wrap gap-2">
          {WEIGHTS.map((option) => (
            <Chip key={option} selected={weight === option} onClick={() => setWeight(option)}>
              {option}
            </Chip>
          ))}
        </div>
      </Field>

      <label className="flex min-h-tap items-center gap-3 text-sm text-ink">
        <input
          type="checkbox"
          checked={diagram}
          onChange={(event) => setDiagram(event.target.checked)}
          className="h-4 w-4 accent-accent"
        />
        Diagram carries marks here
      </label>

      <Button type="submit" variant="primary" size="lg" full disabled={busy || !title.trim()}>
        {submitLabel}
      </Button>
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
      className="space-y-4 p-4 sm:p-5"
      onSubmit={(event) => {
        event.preventDefault()
        onSubmit(parentId || null)
      }}
    >
      <Field label="Move under" htmlFor="new-parent">
        <Select
          id="new-parent"
          value={parentId}
          onChange={(event) => setParentId(event.target.value)}
        >
          <option value="">{node.paper} — top level</option>
          {candidates.map((candidate) => (
            <option key={candidate._id} value={candidate._id}>
              {candidate.path.split('/').slice(1).join(' › ')}
            </option>
          ))}
        </Select>
      </Field>

      <Button type="submit" variant="primary" size="lg" full loading={busy}>
        Move it
      </Button>
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

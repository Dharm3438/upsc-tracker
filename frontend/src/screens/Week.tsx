import { useState } from 'react'
import { ClipboardList, ListChecks, Plus, X } from 'lucide-react'

import type { Todo, Week as WeekData } from '@/api/week'
import { toast } from '@/components/shell/Toast'
import { WeeklyReviewCard } from '@/components/week/WeeklyReviewCard'
import {
  Button,
  Card,
  CardHeader,
  EmptyState,
  Input,
  PageHeader,
  QueryBoundary,
  SkeletonRows,
} from '@/components/ui'
import { useAddTodo, useDeleteTodo, useUpdateTodo, useWeek } from '@/hooks/useWeek'
import { formatDayIST } from '@/lib/date'

/**
 * Two things, in the order the week happens: the list she means to get
 * through, and the note she writes about how it went.
 *
 * The list is free text on purpose. Everything else in the app is tied to a
 * syllabus node and counts itself; this is the one place she can write "finish
 * the Geography backlog" and simply tick it off. Nothing here feeds a
 * statistic, and that is the point.
 */
export function Week() {
  const week = useWeek()

  return (
    <>
      <PageHeader
        title="This week"
        subtitle={
          week.data &&
          `${formatDayIST(week.data.week_start)} – ${formatDayIST(week.data.week_end)}`
        }
      />

      <div className="grid grid-cols-12 items-start gap-4 lg:gap-5">
        <Card className="col-span-12">
          <CardHeader
            title="To-do"
            subtitle="Anything you like — none of it is tied to the syllabus."
            icon={<ListChecks size={17} strokeWidth={1.8} />}
            action={
              week.data &&
              week.data.todos.length > 0 && (
                <span className="text-sm tabular-nums text-muted">
                  {week.data.todos.filter((todo) => todo.done).length} of{' '}
                  {week.data.todos.length} done
                </span>
              )
            }
          />
          <QueryBoundary
            query={week}
            error="Could not load the list."
            skeleton={<SkeletonRows rows={4} />}
          >
            {(data) => <TodoList week={data} />}
          </QueryBoundary>
        </Card>

        <Card className="col-span-12">
          <CardHeader
            title="Weekly review"
            subtitle="Three questions, written once a week, kept with the week's numbers."
            icon={<ClipboardList size={17} strokeWidth={1.8} />}
          />
          <WeeklyReviewCard />
        </Card>
      </div>
    </>
  )
}

function TodoList({ week }: { week: WeekData }) {
  const add = useAddTodo()
  const [draft, setDraft] = useState('')

  function submit(event: React.FormEvent) {
    event.preventDefault()
    const text = draft.trim()
    if (text === '') return
    add.mutate(
      { week_start: week.week_start, text },
      {
        onSuccess: () => setDraft(''),
        onError: () => toast('Could not add that.', 'error'),
      },
    )
  }

  return (
    <>
      {week.todos.length === 0 ? (
        <EmptyState
          size="sm"
          title="Nothing on the list yet."
          description="Write what you mean to get through this week."
        />
      ) : (
        <ul className="divide-y divide-hairline">
          {week.todos.map((todo) => (
            <TodoRow key={todo.id} todo={todo} weekStart={week.week_start} />
          ))}
        </ul>
      )}

      <form onSubmit={submit} className="flex gap-2 border-t border-hairline p-4 sm:p-5">
        <Input
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder="Geography lecture 4…"
          maxLength={300}
          aria-label="Add an item"
        />
        <Button
          type="submit"
          variant="primary"
          icon={<Plus size={15} strokeWidth={2.2} />}
          loading={add.isPending}
          disabled={draft.trim() === ''}
        >
          Add
        </Button>
      </form>
    </>
  )
}

/** A tick box, the text, and a cross. The text becomes an input when tapped,
 *  so editing is where the item already is rather than behind a dialog. */
function TodoRow({ todo, weekStart }: { todo: Todo; weekStart: string }) {
  const update = useUpdateTodo()
  const remove = useDeleteTodo()
  const [draft, setDraft] = useState<string | null>(null)

  function toggle() {
    update.mutate(
      { weekStart, todoId: todo.id, done: !todo.done },
      { onError: () => toast('Could not save that.', 'error') },
    )
  }

  function commit() {
    const text = (draft ?? '').trim()
    setDraft(null)
    if (text === '' || text === todo.text) return
    update.mutate(
      { weekStart, todoId: todo.id, text },
      { onError: () => toast('Could not rename that.', 'error') },
    )
  }

  return (
    <li className="flex items-center gap-3 px-4 py-2.5 sm:px-5">
      <input
        type="checkbox"
        checked={todo.done}
        onChange={toggle}
        aria-label={todo.text}
        className="size-4 shrink-0 cursor-pointer accent-accent"
      />

      {draft === null ? (
        <button
          type="button"
          onClick={() => setDraft(todo.text)}
          className="min-w-0 flex-1 truncate py-1 text-left text-sm text-ink"
        >
          <span className={todo.done ? 'text-muted line-through' : undefined}>{todo.text}</span>
        </button>
      ) : (
        <Input
          autoFocus
          value={draft}
          maxLength={300}
          onChange={(event) => setDraft(event.target.value)}
          onBlur={commit}
          onKeyDown={(event) => {
            if (event.key === 'Enter') commit()
            if (event.key === 'Escape') setDraft(null)
          }}
          className="h-8 flex-1"
          aria-label={`Rename ${todo.text}`}
        />
      )}

      <button
        type="button"
        onClick={() =>
          remove.mutate(
            { weekStart, todoId: todo.id },
            { onError: () => toast('Could not remove that.', 'error') },
          )
        }
        disabled={remove.isPending}
        aria-label={`Remove ${todo.text}`}
        className="shrink-0 rounded-md p-1.5 text-faint transition-colors hover:bg-canvas hover:text-ink disabled:opacity-50"
      >
        <X size={15} strokeWidth={2} />
      </button>
    </li>
  )
}

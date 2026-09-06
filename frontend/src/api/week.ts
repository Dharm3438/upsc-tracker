import { api } from './client'

/** Free text. Nothing here is matched to a syllabus node — it is the list she
 *  writes for herself, and the tree already knows what has been read. */
export type Todo = {
  id: string
  text: string
  done: boolean
}

export type Week = {
  week_start: string
  week_end: string
  /** In the order they were written; ticking one does not move it. */
  todos: Todo[]
  updated_at: string | null
}

export const getWeek = () => api<Week>('/week')

export const addTodo = (body: { week_start?: string; text: string }) =>
  api<Week>('/week/todos', { method: 'POST', body })

export const updateTodo = (
  weekStart: string,
  todoId: string,
  body: { text?: string; done?: boolean },
) => api<Week>(`/week/${weekStart}/todos/${todoId}`, { method: 'PATCH', body })

export const deleteTodo = (weekStart: string, todoId: string) =>
  api<Week>(`/week/${weekStart}/todos/${todoId}`, { method: 'DELETE' })

// Typed fetch wrapper. Holds the single-user API key, attaches it to every
// request, and drops it on a 401 so the app falls back to the unlock screen.

const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000/api'
const KEY_STORAGE = 'upsc.apiKey'

export const UNAUTHORIZED_EVENT = 'upsc:unauthorized'

export function getApiKey(): string | null {
  return localStorage.getItem(KEY_STORAGE)
}

export function setApiKey(key: string): void {
  localStorage.setItem(KEY_STORAGE, key)
}

export function clearApiKey(): void {
  localStorage.removeItem(KEY_STORAGE)
}

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

type Options = {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE'
  body?: unknown
  /** Health check runs before the key exists. */
  skipAuth?: boolean
  signal?: AbortSignal
}

export async function api<T>(path: string, options: Options = {}): Promise<T> {
  const { method = 'GET', body, skipAuth = false, signal } = options
  const headers: Record<string, string> = {}
  const key = getApiKey()

  if (body !== undefined) headers['Content-Type'] = 'application/json'
  if (!skipAuth && key) headers['X-API-Key'] = key

  const response = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    signal,
    body: body === undefined ? undefined : JSON.stringify(body),
  })

  if (response.status === 401) {
    clearApiKey()
    window.dispatchEvent(new Event(UNAUTHORIZED_EVENT))
    throw new ApiError(401, 'Key rejected.')
  }

  if (!response.ok) {
    const detail = await response.text()
    throw new ApiError(response.status, detail || response.statusText)
  }

  if (response.status === 204) return undefined as T
  return (await response.json()) as T
}

export type Health = {
  status: 'ok' | 'degraded'
  mongo: boolean
  configured: boolean
}

export const getHealth = () => api<Health>('/health', { skipAuth: true })

/** Used by the unlock screen. /auth/check never touches the database, so a
 *  rejected key is never confused with a database that is down. */
export async function verifyKey(key: string): Promise<boolean> {
  const response = await fetch(`${BASE_URL}/auth/check`, {
    headers: { 'X-API-Key': key },
  })
  return response.ok
}

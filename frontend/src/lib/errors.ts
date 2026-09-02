// FastAPI sends errors as {"detail": "a sentence"}; the fetch wrapper hands that
// body through as the Error message. Screens want the sentence, not the JSON.
export function readable(error: unknown, fallback = 'That did not save.'): string {
  const message = error instanceof Error ? error.message : String(error)
  try {
    const parsed = JSON.parse(message) as { detail?: unknown }
    if (typeof parsed.detail === 'string') return parsed.detail
  } catch {
    /* not JSON; the raw message is the best we have */
  }
  return message || fallback
}

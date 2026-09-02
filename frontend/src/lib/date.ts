// Every "study day" is a YYYY-MM-DD string in IST. Deriving it from the phone's
// clock would roll over at the wrong moment for anyone logging at 11:45pm, so
// the conversion is always explicit about Asia/Kolkata.

export const IST = 'Asia/Kolkata'

const ymd = new Intl.DateTimeFormat('en-CA', {
  timeZone: IST,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})

const parts = new Intl.DateTimeFormat('en-GB', {
  timeZone: IST,
  weekday: 'short',
  day: 'numeric',
  month: 'short',
})

/** Today in IST, as YYYY-MM-DD. */
export function todayIST(now: Date = new Date()): string {
  return ymd.format(now)
}

/** "Wed 2 Sep" — the header date. Assembled by part so the separators stay
 *  consistent across locales rather than following the browser's. */
export function formatDayIST(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(`${date}T00:00:00+05:30`) : date
  const found = Object.fromEntries(
    parts.formatToParts(d).map((part) => [part.type, part.value]),
  )
  return `${found.weekday} ${found.day} ${found.month}`
}

/** Whole days from today to a YYYY-MM-DD date, in IST. Negative once past. */
export function daysUntil(target: string, now: Date = new Date()): number {
  const from = Date.parse(`${todayIST(now)}T00:00:00+05:30`)
  const to = Date.parse(`${target}T00:00:00+05:30`)
  return Math.round((to - from) / 86_400_000)
}

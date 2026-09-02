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

// en-US rather than en-GB: the latter abbreviates September to "Sept".
const parts = new Intl.DateTimeFormat('en-US', {
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

/** Day of the week for a YYYY-MM-DD study day, 0 = Sunday.
 *
 *  Built from the parts rather than from a parsed instant: `new Date(...)` on an
 *  IST midnight lands the evening before in UTC, and `getUTCDay` would then name
 *  the wrong day. A study day has no time in it, so neither should this. */
export function weekdayIST(day: string): number {
  const [year, month, date] = day.split('-').map(Number)
  return new Date(Date.UTC(year, month - 1, date)).getUTCDay()
}

/** The Monday on or before a study day, matching the server's week. Weeks
 *  start on Monday because the review is written at the weekend about the week
 *  that has just ended. */
export function weekStartIST(day: string = todayIST()): string {
  // weekdayIST is 0 = Sunday, so Monday is 1 and Sunday is six days in.
  const back = (weekdayIST(day) + 6) % 7
  return shiftDay(day, -back)
}

/** Move a study day by whole days, staying in the YYYY-MM-DD form. */
export function shiftDay(day: string, days: number): string {
  const [year, month, date] = day.split('-').map(Number)
  const moved = new Date(Date.UTC(year, month - 1, date + days))
  return moved.toISOString().slice(0, 10)
}

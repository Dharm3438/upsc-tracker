/**
 * Join class names, dropping anything falsy. Deliberately not `clsx` +
 * `tailwind-merge`: nothing here conditionally overrides the same Tailwind
 * property from two sources, so the 8kB of merge logic would buy nothing.
 */
export function cn(...parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(' ')
}

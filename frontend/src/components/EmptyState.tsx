/** Empty states invite the next action rather than apologising (plan §9). */
export function EmptyState({ children }: { children: React.ReactNode }) {
  return <p className="px-4 py-8 text-sm text-slate">{children}</p>
}

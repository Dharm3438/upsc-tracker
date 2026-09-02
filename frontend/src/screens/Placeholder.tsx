import { EmptyState } from '@/components/EmptyState'
import { Header } from '@/components/shell/Header'

/** Tabs whose screens land in later phases. Named so the shell is real now. */
export function Placeholder({ title, phase }: { title: string; phase: string }) {
  return (
    <>
      <Header title={title} />
      <EmptyState>Arrives in {phase}.</EmptyState>
    </>
  )
}

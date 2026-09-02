import { useQuery } from '@tanstack/react-query'

import { getHealth } from '@/api/client'
import { usePapers } from '@/hooks/useSyllabus'
import { Header } from '@/components/shell/Header'

/**
 * Phase 0/1 version: the countdown, the due list and the reading shortcuts
 * arrive with the revision engine (phase 3). For now this proves the keyed
 * client reaches the API and the syllabus is really in the database.
 */
export function Today() {
  const health = useQuery({ queryKey: ['health'], queryFn: getHealth, refetchInterval: 60_000 })
  const papers = usePapers()

  const totalNodes = papers.data?.reduce(
    (sum, paper) => sum + paper.sections + paper.topics + paper.leaves,
    0,
  )

  return (
    <>
      <Header />
      <section className="px-4">
        <p className="text-sm text-slate">
          Due lists and the countdown arrive with the revision engine. Until then,
          the syllabus map is the thing to explore.
        </p>
      </section>

      <section className="mt-6 border-t border-line bg-surface">
        <Row label="API" value={health.isLoading ? '…' : (health.data?.status ?? 'unreachable')} />
        <Row label="Database" value={health.data?.mongo ? 'connected' : 'not connected'} />
        <Row
          label="Syllabus nodes"
          value={papers.isLoading ? '…' : totalNodes ? String(totalNodes) : 'not seeded'}
        />
      </section>
    </>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex min-h-tap items-center justify-between border-b border-line px-4">
      <span className="text-sm">{label}</span>
      <span className="text-sm text-slate">{value}</span>
    </div>
  )
}

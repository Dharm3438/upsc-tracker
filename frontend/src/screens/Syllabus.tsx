import { useEffect, useMemo, useState } from 'react'
import { ListTree, Search } from 'lucide-react'
import { Link, Outlet, useMatch } from 'react-router-dom'

import type { Paper, TreeNode } from '@/api/syllabus'
import { PaperChips } from '@/components/PaperChips'
import { NodeActions } from '@/components/tree/NodeActions'
import { SyllabusTree } from '@/components/tree/SyllabusTree'
import {
  Card,
  EmptyState,
  PageHeader,
  QueryBoundary,
  SearchInput,
  SkeletonRows,
  StatTile,
} from '@/components/ui'
import { usePapers, useNodeSearch, useTree } from '@/hooks/useSyllabus'
import { cn } from '@/lib/cn'

const SEARCH_DEBOUNCE_MS = 250

/**
 * Master and detail. From `lg` up the tree keeps its own scrolling rail on the
 * left and the topic opens beside it, so reading a topic never loses your place
 * in a 200-row paper. Below `lg` it is the push-navigation it has always been:
 * the tree, then the topic instead of it.
 */
export function Syllabus() {
  const [paper, setPaper] = useState<Paper>('GS1')
  const [acting, setActing] = useState<TreeNode | null>(null)
  const [search, setSearch] = useState('')
  const [debounced, setDebounced] = useState('')

  const papers = usePapers()
  const tree = useTree(paper)
  const results = useNodeSearch(debounced)

  // A child route's params are not visible to useParams here, so match the path.
  const open = useMatch('/syllabus/node/:nodeId')
  const openId = open?.params.nodeId

  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(search.trim()), SEARCH_DEBOUNCE_MS)
    return () => window.clearTimeout(timer)
  }, [search])

  const candidates = useMemo(
    () => (acting && tree.data ? moveTargets(tree.data, acting) : []),
    [acting, tree.data],
  )

  const searching = debounced.length > 1

  return (
    <>
      <div className={cn(openId && 'hidden lg:block')}>
        <PageHeader
          title="Syllabus"
          subtitle="Every paper, three levels deep. The bar on each row is how well it has come back."
        />
      </div>

      <div className="grid grid-cols-12 items-start gap-5 lg:gap-6">
        {/* The rail. Hidden on a phone once a topic is open. */}
        <div
          className={cn(
            'col-span-12 min-w-0 lg:col-span-5 xl:col-span-4',
            openId && 'hidden lg:block',
          )}
        >
          <div className="space-y-3 lg:sticky lg:top-[calc(theme(spacing.topnav)+24px)]">
            <SearchInput
              value={search}
              onChange={setSearch}
              placeholder="Search every paper…"
            />
            {papers.data && (
              <PaperChips papers={papers.data} selected={paper} onSelect={setPaper} showCounts />
            )}

            <Card className="lg:max-h-[calc(100dvh-16rem)]">
              <div className="scroll-thin min-h-0 flex-1 overflow-y-auto">
                {searching ? (
                  <QueryBoundary
                    query={results}
                    error="Could not search the syllabus."
                    skeleton={<SkeletonRows rows={5} />}
                    isEmpty={(data) => data.length === 0}
                    empty={
                      <EmptyState
                        size="sm"
                        icon={Search}
                        title="No topics match that."
                        description="Try a shorter word — the search runs over the full path."
                      />
                    }
                  >
                    {(data) => (
                      <ul className="divide-y divide-hairline">
                        {data.map((node) => (
                          <li key={node._id}>
                            <Link
                              to={`/syllabus/node/${node._id}`}
                              className={cn(
                                'block px-4 py-2.5 transition-colors hover:bg-canvas',
                                node._id === openId && 'bg-accent-soft',
                              )}
                            >
                              <span className="block truncate text-sm text-ink">{node.title}</span>
                              <span className="block truncate text-xs text-muted">
                                {node.path.split('/').slice(0, -1).join(' › ')}
                              </span>
                            </Link>
                          </li>
                        ))}
                      </ul>
                    )}
                  </QueryBoundary>
                ) : (
                  <QueryBoundary
                    query={tree}
                    error="Could not load the syllabus."
                    skeleton={<SkeletonRows rows={8} />}
                    isEmpty={(data) => data.length === 0}
                    empty={
                      <EmptyState
                        size="sm"
                        icon={ListTree}
                        title="Nothing seeded for this paper."
                        description="Run the seed script to populate it."
                      />
                    }
                  >
                    {(data) => (
                      <SyllabusTree nodes={data} selectedId={openId} onLongPress={setActing} />
                    )}
                  </QueryBoundary>
                )}
              </div>
            </Card>
          </div>
        </div>

        {/* The detail pane. On a phone this is the whole screen. */}
        <div className={cn('col-span-12 min-w-0 lg:col-span-7 xl:col-span-8', !openId && 'hidden lg:block')}>
          {openId ? <Outlet /> : <PaperOverview paper={paper} />}
        </div>
      </div>

      {acting && (
        <NodeActions node={acting} candidates={candidates} onClose={() => setActing(null)} />
      )}
    </>
  )
}

/** What the right pane says before a topic is picked. A blank half-screen reads
 *  as a bug; the paper's shape is at least worth knowing. */
function PaperOverview({ paper }: { paper: Paper }) {
  const papers = usePapers()
  const summary = papers.data?.find((item) => item.paper === paper)

  return (
    <Card className="min-h-[280px] justify-center">
      <EmptyState
        icon={ListTree}
        title={summary ? summary.label : 'Pick a topic'}
        description="Choose a topic on the left to see its history, its notes and what it is due for."
      />
      {summary && (
        <div className="grid grid-cols-3 gap-3 px-4 pb-6 sm:px-6">
          <StatTile label="Sections" value={summary.sections} />
          <StatTile label="Topics" value={summary.topics} />
          <StatTile label="Leaves" value={summary.leaves} />
        </div>
      )}
    </Card>
  )
}

/**
 * Somewhere `moving` could legally go: not itself, not inside its own subtree,
 * and not so deep that the subtree would spill past level 3. The server checks
 * all of this too; offering impossible options would just invite an error.
 */
function moveTargets(tree: TreeNode[], moving: TreeNode): TreeNode[] {
  const banned = new Set<string>([moving._id])
  const collectSubtree = (node: TreeNode) => {
    banned.add(node._id)
    node.children.forEach(collectSubtree)
  }
  collectSubtree(moving)

  const depth = subtreeDepth(moving)
  const out: TreeNode[] = []
  const walk = (nodes: TreeNode[]) => {
    for (const node of nodes) {
      if (!banned.has(node._id) && node.level + depth < 3) out.push(node)
      walk(node.children)
    }
  }
  walk(tree)
  return out
}

function subtreeDepth(node: TreeNode): number {
  if (node.children.length === 0) return 0
  return 1 + Math.max(...node.children.map(subtreeDepth))
}

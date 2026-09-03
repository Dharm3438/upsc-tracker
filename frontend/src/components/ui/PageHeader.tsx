import type { ReactNode } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Link } from 'react-router-dom'

import { cn } from '@/lib/cn'

export type Crumb = { label: string; to?: string }

/**
 * The top of every screen. Replaces shell/Header.tsx and the four hand-rolled
 * back-headers in NodeDetail, TestDetail, AnswerDetail and AnswerTimer.
 */
export function PageHeader({
  title,
  eyebrow,
  subtitle,
  breadcrumbs,
  back,
  actions,
  meta,
  className,
}: {
  title: ReactNode
  eyebrow?: ReactNode
  subtitle?: ReactNode
  breadcrumbs?: Crumb[]
  back?: { label: string; to: string; className?: string }
  actions?: ReactNode
  meta?: ReactNode
  className?: string
}) {
  return (
    <header className={cn('mb-5 min-w-0 lg:mb-6', className)}>
      {back && (
        <Link
          to={back.to}
          className={cn(
            'mb-2 inline-flex items-center gap-1 text-sm text-muted transition-colors hover:text-accent',
            back.className,
          )}
        >
          <ChevronLeft size={15} strokeWidth={2} />
          {back.label}
        </Link>
      )}

      {breadcrumbs && breadcrumbs.length > 0 && (
        <nav aria-label="Breadcrumb" className="mb-1.5 flex flex-wrap items-center gap-1 text-xs">
          {breadcrumbs.map((crumb, index) => (
            <span key={`${crumb.label}-${index}`} className="flex items-center gap-1">
              {index > 0 && <ChevronRight size={12} className="text-hairline" aria-hidden />}
              {crumb.to ? (
                <Link to={crumb.to} className="text-muted hover:text-accent">
                  {crumb.label}
                </Link>
              ) : (
                <span className="text-faint">{crumb.label}</span>
              )}
            </span>
          ))}
        </nav>
      )}

      <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-3">
        <div className="min-w-0">
          {eyebrow && (
            <p className="pb-1 text-xs font-semibold uppercase tracking-[0.08em] text-faint">
              {eyebrow}
            </p>
          )}
          <h1 className="font-display text-2xl font-semibold leading-tight text-ink lg:text-3xl">
            {title}
          </h1>
          {subtitle && <p className="pt-1.5 max-w-prose text-sm text-muted">{subtitle}</p>}
          {meta && <div className="flex flex-wrap items-center gap-2 pt-2.5">{meta}</div>}
        </div>
        {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
      </div>
    </header>
  )
}

import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { Link } from 'react-router-dom'

import { cn } from '@/lib/cn'

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'onDark'
export type ButtonSize = 'sm' | 'md' | 'lg'

const VARIANT: Record<ButtonVariant, string> = {
  primary:
    'bg-accent text-white shadow-xs hover:bg-accent-hover active:bg-accent-hover disabled:hover:bg-accent',
  secondary:
    'border border-edge bg-surface text-ink hover:border-faint hover:bg-raised disabled:hover:bg-surface',
  ghost: 'text-muted hover:bg-accent-soft hover:text-accent',
  danger:
    'border border-danger/25 bg-danger-soft text-danger hover:bg-danger hover:text-white disabled:hover:bg-danger-soft disabled:hover:text-danger',
  onDark: 'bg-white/10 text-white ring-1 ring-inset ring-white/15 hover:bg-white/20',
}

const SIZE: Record<ButtonSize, string> = {
  sm: 'h-8 gap-1.5 px-3 text-sm',
  md: 'h-10 gap-2 px-4 text-sm',
  lg: 'h-tap gap-2 px-5 text-base',
}

export function buttonClasses(
  variant: ButtonVariant = 'secondary',
  size: ButtonSize = 'md',
  full = false,
): string {
  return cn(
    'inline-flex items-center justify-center whitespace-nowrap rounded-md font-medium transition-colors',
    'disabled:cursor-not-allowed disabled:opacity-50',
    VARIANT[variant],
    SIZE[size],
    // `shrink-0` keeps a button from being squashed in a header row, but a
    // full-width one in a flex row has to share: two `w-full` siblings that
    // cannot shrink overflow their container.
    full ? 'w-full flex-1' : 'shrink-0',
  )
}

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant
  size?: ButtonSize
  full?: boolean
  icon?: ReactNode
  iconRight?: ReactNode
  loading?: boolean
}

export function Button({
  variant = 'secondary',
  size = 'md',
  full = false,
  icon,
  iconRight,
  loading = false,
  className,
  children,
  disabled,
  type = 'button',
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled ?? loading}
      className={cn(buttonClasses(variant, size, full), className)}
      {...rest}
    >
      {loading ? <Spinner /> : icon}
      {children}
      {iconRight}
    </button>
  )
}

/** Same skin, but a route change rather than a handler. */
export function LinkButton({
  to,
  variant = 'secondary',
  size = 'md',
  full = false,
  icon,
  iconRight,
  className,
  children,
}: {
  to: string
  variant?: ButtonVariant
  size?: ButtonSize
  full?: boolean
  icon?: ReactNode
  iconRight?: ReactNode
  className?: string
  children: ReactNode
}) {
  return (
    <Link to={to} className={cn(buttonClasses(variant, size, full), className)}>
      {icon}
      {children}
      {iconRight}
    </Link>
  )
}

function Spinner() {
  return (
    <span
      aria-hidden
      className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent"
    />
  )
}

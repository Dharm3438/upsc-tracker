import { forwardRef } from 'react'
import type { InputHTMLAttributes, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react'
import { Search } from 'lucide-react'

import { cn } from '@/lib/cn'

const CONTROL =
  'w-full min-w-0 rounded-md border border-edge bg-surface px-3 text-ink placeholder:text-faint ' +
  'transition-colors hover:border-faint focus:border-accent focus:outline-none ' +
  'disabled:cursor-not-allowed disabled:bg-canvas disabled:text-muted'

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className, ...rest }, ref) {
    return <input ref={ref} className={cn(CONTROL, 'h-10 text-sm', className)} {...rest} />
  },
)

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(
  function Textarea({ className, ...rest }, ref) {
    return (
      <textarea ref={ref} className={cn(CONTROL, 'resize-y py-2.5 text-sm', className)} {...rest} />
    )
  },
)

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(
  function Select({ className, ...rest }, ref) {
    return <select ref={ref} className={cn(CONTROL, 'h-10 pr-8 text-sm', className)} {...rest} />
  },
)

export function SearchInput({
  value,
  onChange,
  placeholder,
  className,
  ...rest
}: Omit<InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'value'> & {
  value: string
  onChange: (value: string) => void
}) {
  return (
    <div className={cn('relative', className)}>
      <Search
        aria-hidden
        size={15}
        strokeWidth={1.75}
        className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-faint"
      />
      <Input
        type="search"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="pl-9"
        {...rest}
      />
    </div>
  )
}

/**
 * `inputMode` rather than `type="number"`: no spinners, and a phone opens the
 * numeric keypad, which is the only part that matters. Replaces two private
 * copies (QuickLogSheet, AnswerTimer) — the `decimals` flag is what the second
 * one added.
 */
export function NumberInput({
  value,
  onChange,
  placeholder,
  decimals = false,
  suffix,
  className,
  ...rest
}: Omit<InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'value'> & {
  value: string
  onChange: (value: string) => void
  decimals?: boolean
  suffix?: string
}) {
  const strip = (raw: string) =>
    decimals ? raw.replace(/[^0-9.]/g, '').replace(/(\..*)\./g, '$1') : raw.replace(/\D/g, '')

  return (
    <div className={cn('relative', className)}>
      <Input
        inputMode={decimals ? 'decimal' : 'numeric'}
        pattern={decimals ? '[0-9.]*' : '[0-9]*'}
        value={value}
        onChange={(event) => onChange(strip(event.target.value))}
        placeholder={placeholder}
        className={cn('tabular-nums', suffix && 'pr-10')}
        {...rest}
      />
      {suffix && (
        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-faint">
          {suffix}
        </span>
      )}
    </div>
  )
}

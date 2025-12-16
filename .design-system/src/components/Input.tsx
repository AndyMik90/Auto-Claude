import React from 'react'
import { cn } from '../lib/utils'

export function Input({
  placeholder,
  className,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        'h-10 w-full px-4 rounded-[var(--radius-md)] border border-[var(--color-border-default)]',
        'bg-[var(--color-surface-card)] text-[var(--color-text-primary)] text-sm',
        'focus:outline-none focus:border-[var(--color-accent-primary)] focus:ring-2 focus:ring-[var(--color-accent-primary)]/20',
        'placeholder:text-[var(--color-text-tertiary)]',
        'transition-all duration-200',
        'disabled:bg-[var(--color-background-secondary)] disabled:opacity-60',
        className
      )}
      placeholder={placeholder}
      {...props}
    />
  )
}

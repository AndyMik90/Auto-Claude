import React from 'react'
import { cn } from '../lib/utils'

export interface BadgeProps {
  children: React.ReactNode
  variant?: 'default' | 'primary' | 'success' | 'warning' | 'error' | 'outline'
}

export function Badge({ children, variant = 'default' }: BadgeProps) {
  const variants = {
    default: 'bg-[var(--color-background-secondary)] text-[var(--color-text-secondary)]',
    primary: 'bg-[var(--color-accent-primary-light)] text-[var(--color-accent-primary)]',
    success: 'bg-[var(--color-semantic-success-light)] text-[var(--color-semantic-success)]',
    warning: 'bg-[var(--color-semantic-warning-light)] text-[var(--color-semantic-warning)]',
    error: 'bg-[var(--color-semantic-error-light)] text-[var(--color-semantic-error)]',
    outline: 'bg-transparent border border-[var(--color-border-default)] text-[var(--color-text-secondary)]'
  }

  return (
    <span className={cn(
      'inline-flex items-center px-3 py-1 rounded-full text-label-small',
      variants[variant]
    )}>
      {children}
    </span>
  )
}

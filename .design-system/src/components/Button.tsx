import React from 'react'
import { cn } from '../lib/utils'

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'success' | 'danger'
  size?: 'sm' | 'md' | 'lg'
  pill?: boolean
}

export function Button({
  children,
  variant = 'primary',
  size = 'md',
  pill = false,
  className,
  ...props
}: ButtonProps) {
  const baseStyles = 'inline-flex items-center justify-center font-medium transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2'

  const variants = {
    primary: 'bg-[var(--color-accent-primary)] text-[var(--color-text-inverse)] hover:bg-[var(--color-accent-primary-hover)] focus:ring-[var(--color-accent-primary)]',
    secondary: 'bg-transparent border border-[var(--color-border-default)] text-[var(--color-text-primary)] hover:bg-[var(--color-background-secondary)]',
    ghost: 'bg-transparent text-[var(--color-text-secondary)] hover:bg-[var(--color-background-secondary)]',
    success: 'bg-[var(--color-semantic-success)] text-white hover:opacity-90',
    danger: 'bg-[var(--color-semantic-error)] text-white hover:opacity-90'
  }

  const sizes = {
    sm: 'h-8 px-3 text-xs',
    md: 'h-10 px-4 text-sm',
    lg: 'h-12 px-6 text-base'
  }

  const radius = pill ? 'rounded-full' : 'rounded-[var(--radius-md)]'

  return (
    <button
      className={cn(baseStyles, variants[variant], sizes[size], radius, className)}
      {...props}
    >
      {children}
    </button>
  )
}

import React from 'react'
import { cn } from '../lib/utils'

export interface CardProps {
  children: React.ReactNode
  className?: string
  padding?: boolean
}

export function Card({
  children,
  className,
  padding = true
}: CardProps) {
  return (
    <div className={cn(
      'bg-[var(--color-surface-card)] rounded-[var(--radius-xl)] shadow-[var(--shadow-md)]',
      padding && 'p-6',
      className
    )}>
      {children}
    </div>
  )
}

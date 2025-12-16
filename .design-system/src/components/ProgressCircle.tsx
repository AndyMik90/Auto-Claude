import React from 'react'
import { cn } from '../lib/utils'

export interface ProgressCircleProps {
  value: number
  size?: 'sm' | 'md' | 'lg'
  color?: string
}

export function ProgressCircle({
  value,
  size = 'md',
  color = 'var(--color-accent-primary)'
}: ProgressCircleProps) {
  const sizes = {
    sm: { width: 40, stroke: 4, fontSize: 'text-[10px]' },
    md: { width: 56, stroke: 5, fontSize: 'text-xs' },
    lg: { width: 80, stroke: 6, fontSize: 'text-base' }
  }

  const { width, stroke, fontSize } = sizes[size]
  const radius = (width - stroke) / 2
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (value / 100) * circumference

  return (
    <div className="relative inline-flex items-center justify-center">
      <svg width={width} height={width} className="-rotate-90">
        <circle
          cx={width / 2}
          cy={width / 2}
          r={radius}
          fill="none"
          stroke="var(--color-border-default)"
          strokeWidth={stroke}
        />
        <circle
          cx={width / 2}
          cy={width / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className="transition-all duration-500"
        />
      </svg>
      <span className={cn('absolute font-semibold', fontSize)}>
        {value}%
      </span>
    </div>
  )
}

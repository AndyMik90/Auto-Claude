import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../../lib/utils';

/* Apple HIG-inspired badge component
   Key principles:
   - Pill-shaped (rounded-full) for modern appearance
   - Small text (11-13px) with semibold weight
   - Semantic colors for clear communication
   - Subtle backgrounds with stronger borders for outline variants
   - Proper padding for breathing room
   - Glass effect support for liquid glass design
*/
const badgeVariants = cva(
  'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-all duration-150 ease-out focus:outline-none focus:ring-2 focus:ring-ring/50 focus:ring-offset-2',
  {
    variants: {
      variant: {
        default: 'border-transparent bg-primary text-primary-foreground shadow-sm',
        secondary: 'border-transparent bg-secondary text-secondary-foreground',
        destructive: 'border-transparent bg-destructive text-destructive-foreground shadow-sm',
        outline: 'text-foreground border-border',
        success: 'border-transparent bg-success/15 text-success border-success/30',
        warning: 'border-transparent bg-warning/15 text-warning border-warning/30',
        info: 'border-transparent bg-info/15 text-info border-info/30',
        purple: 'border-transparent bg-purple-500/15 text-purple-400 border-purple-500/30',
        muted: 'border-transparent bg-muted text-muted-foreground',
        glass: 'glass-surface border-white/10 dark:border-white/5 bg-white/5 dark:bg-white/10 backdrop-blur-md text-foreground',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { Badge, badgeVariants };

import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../../lib/utils';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement>, VariantProps<typeof inputVariants> {}

/* Apple HIG-inspired input component
   Key principles:
   - Rounded corners (10-12px) for modern appearance
   - Subtle borders with clear focus states
   - Smooth transitions for focus/blur
   - Proper padding for text (Apple's recommended spacing)
   - Minimum 44pt height for touch targets
   - Glass effect support for liquid glass design
*/

const inputVariants = cva(
  'flex h-11 w-full rounded-xl border px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/60 tap-target transition-all duration-150 ease-out file:border-0 file:bg-transparent file:text-sm file:font-medium focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50',
  {
    variants: {
      variant: {
        default: 'border-border bg-card focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:border-primary',
        glass: 'border-white/10 dark:border-white/5 bg-white/5 dark:bg-white/10 backdrop-blur-md focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:border-primary/50',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
);

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, variant, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(inputVariants({ variant }), className)}
        ref={ref}
        {...props}
      />
    );
  }
);
Input.displayName = 'Input';

export { Input, inputVariants };

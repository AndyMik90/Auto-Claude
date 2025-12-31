import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../../lib/utils';

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement>, VariantProps<typeof textareaVariants> {}

/* Apple HIG-inspired textarea component
   Key principles:
   - Rounded corners matching input fields
   - Consistent padding and focus states
   - Smooth transitions for focus/blur
   - Proper minimum height for comfort
   - Glass effect support for liquid glass design
*/

const textareaVariants = cva(
  'flex min-h-[80px] w-full rounded-xl border px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/60 resize-none transition-all duration-150 ease-out focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50',
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

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, variant, ...props }, ref) => {
    return (
      <textarea
        className={cn(textareaVariants({ variant }), className)}
        ref={ref}
        {...props}
      />
    );
  }
);
Textarea.displayName = 'Textarea';

export { Textarea, textareaVariants };

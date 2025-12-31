import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../../lib/utils';

/* Apple HIG-inspired button component
   Key principles:
   - Minimum 44x44pt tap targets for touch
   - Haptic-style visual feedback with scale transforms
   - Smooth easing functions (cubic-bezier for natural motion)
   - Subtle shadows for depth without heaviness
   - Clear visual hierarchy through variants
*/
const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap font-medium tap-target focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        default:
          /* Primary button - Apple's filled style with haptic feedback */
          'bg-primary text-primary-foreground shadow-sm hover:bg-primary/90 hover:shadow active:scale-[0.97] transition-all duration-150',
        destructive:
          /* Destructive action - red with same behavior as primary */
          'bg-destructive text-destructive-foreground shadow-sm hover:bg-destructive/90 hover:shadow active:scale-[0.97] transition-all duration-150',
        outline:
          /* Secondary action - bordered with subtle hover */
          'border border-border bg-transparent hover:bg-accent hover:text-accent-foreground active:scale-[0.97] transition-all duration-150',
        secondary:
          /* Tertiary action - filled but lower prominence */
          'bg-secondary text-secondary-foreground hover:bg-secondary/80 active:scale-[0.97] transition-all duration-150',
        ghost:
          /* Minimal button - no border, only hover state */
          'hover:bg-accent/80 hover:text-accent-foreground active:scale-[0.97] transition-all duration-150',
        link:
          /* Text-only button - underline on hover */
          'text-primary underline-offset-4 hover:underline active:scale-[0.97] transition-all duration-150',
        success:
          /* Success action - green semantic */
          'bg-[var(--success)] text-[var(--success-foreground)] shadow-sm hover:bg-[var(--success)]/90 hover:shadow active:scale-[0.97] transition-all duration-150',
        warning:
          /* Warning action - orange/yellow semantic */
          'bg-warning text-warning-foreground shadow-sm hover:bg-warning/90 hover:shadow active:scale-[0.97] transition-all duration-150',
        // NEW: Liquid glass variants - preserving Apple glassmorphism effects
        'glass-primary':
          /* Glass primary button with backdrop blur */
          'bg-primary/80 backdrop-blur-md text-primary-foreground border border-primary/20 shadow-lg hover:bg-primary/90 hover:shadow-xl active:scale-[0.97] transition-all duration-200',
        'glass-outline':
          /* Glass outline button with translucent border */
          'border border-white/10 dark:border-white/5 bg-white/5 dark:bg-white/10 backdrop-blur-md hover:bg-white/10 dark:hover:bg-white/15 hover:border-white/20 active:scale-[0.97] transition-all duration-200',
        'glass-ghost':
          /* Glass ghost button with minimal styling */
          'bg-transparent backdrop-blur-sm hover:bg-white/5 dark:hover:bg-white/10 active:scale-[0.97] transition-all duration-200',
      },
      size: {
        /* Apple HIG recommended sizes (with 44pt minimum for touch) */
        default: 'h-11 px-4.5 py-2.5 text-sm rounded-xl', /* 44pt height */
        sm: 'h-9 px-3.5 text-xs rounded-lg', /* 36pt height */
        lg: 'h-13 px-6 text-base rounded-xl', /* 52pt height */
        icon: 'h-11 w-11 rounded-xl', /* 44x44pt square */
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button';
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = 'Button';

export { Button, buttonVariants };

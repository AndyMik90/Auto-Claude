import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../../lib/utils';

/* Apple HIG-inspired alert component
   Key principles:
   - Clear visual hierarchy with semantic colors
   - Smooth transitions with Apple easing
   - Accessible with proper ARIA attributes
   - Optional dismiss functionality
*/

const alertVariants = cva(
  'relative w-full rounded-2xl p-4 tap-target transition-all duration-200 ease-out',
  {
    variants: {
      variant: {
        default: 'bg-card border border-border text-foreground shadow-sm',
        destructive: 'border-destructive/50 bg-destructive/10 text-destructive shadow-sm',
        success: 'border-[var(--success)]/50 bg-[var(--success-light)] text-[var(--success)] shadow-sm',
        warning: 'border-[var(--warning)]/50 bg-[var(--warning-light)] text-[var(--warning)] shadow-sm',
        info: 'border-[var(--info)]/50 bg-[var(--info-light)] text-[var(--info)] shadow-sm',
      },
    glass: {
        true: 'glass-surface',
        false: '',
      },
    },
    defaultVariants: {
      variant: 'default',
      glass: false,
    },
  }
);

export interface AlertProps extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof alertVariants> {
  title?: string;
  icon?: React.ReactNode;
  dismissible?: boolean;
  onDismiss?: () => void;
}

const Alert = React.forwardRef<HTMLDivElement, AlertProps>(
  ({ className, variant, title, icon, dismissible = false, onDismiss, children, ...props }, ref) => {
    const [isDismissed, setIsDismissed] = React.useState(false);

    const handleDismiss = () => {
      setIsDismissed(true);
      onDismiss?.();
    };

    if (isDismissed) {
      return null;
    }

    return (
      <div
        ref={ref}
        role="alert"
        className={cn(alertVariants({ variant, glass: props.glass }), className)}
        {...props}
      >
        <div className="flex items-start gap-3">
          {icon && (
            <div className="flex-shrink-0 mt-0.5">
              {icon}
            </div>
          )}
          <div className="flex-1 min-w-0">
            {title && (
              <h5 className="mb-1 font-medium leading-none tracking-tight">
                {title}
              </h5>
            )}
            <div className="text-sm leading-relaxed [&_p]:leading-relaxed">
              {children}
            </div>
          </div>
          {dismissible && (
            <button
              onClick={handleDismiss}
              className="flex-shrink-0 rounded-lg p-1 hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
              aria-label="Dismiss alert"
            >
              <svg
                className="h-4 w-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          )}
        </div>
      </div>
    );
  });
Alert.displayName = 'Alert';

const AlertTitle = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => (
  <h5
    ref={ref}
    className={cn('mb-1 font-medium leading-none tracking-tight', className)}
    {...props}
  />
));
AlertTitle.displayName = 'AlertTitle';

const AlertDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn('text-sm leading-relaxed [&_p]:leading-relaxed', className)}
    {...props}
  />
));
AlertDescription.displayName = 'AlertDescription';

export { Alert, AlertTitle, AlertDescription, alertVariants };

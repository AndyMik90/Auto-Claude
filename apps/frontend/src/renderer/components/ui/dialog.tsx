import * as React from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { cva, type VariantProps } from 'class-variance-authority';
import { X } from 'lucide-react';
import { cn } from '../../lib/utils';

/* Apple HIG-inspired dialog components
   Key principles:
   - Translucent backdrop (backdrop-blur) for depth
   - Centered presentation with subtle zoom animation
   - Clear focus management
   - Rounded corners (14-20px) for modern appearance
   - Proper spacing for breathing room
   - Glass effect support for liquid glass design
*/

const Dialog = DialogPrimitive.Root;

const DialogTrigger = DialogPrimitive.Trigger;

const DialogPortal = DialogPrimitive.Portal;

const DialogClose = DialogPrimitive.Close;

const dialogContentVariants = cva(
  'fixed left-[50%] top-[50%] z-50 w-full max-w-lg max-h-[90vh] translate-x-[-50%] translate-y-[-50%] border rounded-2xl shadow-2xl p-8 overflow-hidden flex flex-col data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-98 data-[state=open]:zoom-in-98 duration-200 ease-out',
  {
    variants: {
      variant: {
        default: 'bg-card border-border',
        glass: 'glass-surface border-white/10 dark:border-white/5',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
);

/* Apple-style overlay with translucency */
const DialogOverlay = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    className={cn(
      /* Fixed full-screen overlay */
      'fixed inset-0 z-50',
      /* Apple's translucent backdrop with blur */
      'bg-black/20 backdrop-blur-sm',
      /* Dark mode: more opaque backdrop */
      'dark:bg-black/40 backdrop-blur-md',
      /* Fade animations */
      'data-[state=open]:animate-in data-[state=closed]:animate-out',
      'data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
      /* Smooth easing */
      'duration-200 ease-out',
      className
    )}
    {...props}
  />
));
DialogOverlay.displayName = DialogPrimitive.Overlay.displayName;

interface DialogContentProps extends React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content>, VariantProps<typeof dialogContentVariants> {
  hideCloseButton?: boolean;
}

/* Apple-style dialog content */
const DialogContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  DialogContentProps
>(({ className, variant = 'default', children, hideCloseButton, ...props }, ref) => (
  <DialogPortal>
    <DialogOverlay />
    <DialogPrimitive.Content
      ref={ref}
      className={cn(dialogContentVariants({ variant }), className)}
      {...props}
    >
      {children}
      {!hideCloseButton && (
        <DialogPrimitive.Close
          className={cn(
            /* Apple-style close button: circle, top-right */
            'absolute right-4 top-4 tap-target rounded-full p-2 z-10',
            /* Colors */
            'text-muted-foreground hover:text-foreground',
            /* Hover state */
            'hover:bg-accent/80',
            /* Transitions */
            'transition-all duration-150 ease-out',
            /* Focus */
            'focus:outline-none focus:ring-2 focus:ring-ring/50',
            'disabled:pointer-events-none'
          )}
        >
          <X className="h-4 w-4" strokeWidth={2.5} />
          <span className="sr-only">Close</span>
        </DialogPrimitive.Close>
      )}
    </DialogPrimitive.Content>
  </DialogPortal>
));
DialogContent.displayName = DialogPrimitive.Content.displayName;

/* Dialog header with proper spacing */
const DialogHeader = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      /* Apple's vertical spacing */
      'flex flex-col space-y-1.5 text-center sm:text-left mb-4',
      className
    )}
    {...props}
  />
);
DialogHeader.displayName = 'DialogHeader';

/* Dialog body for content area */
const DialogBody = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      'flex-1 overflow-y-auto',
      className
    )}
    {...props}
  />
);
DialogBody.displayName = 'DialogBody';

/* Dialog footer for actions */
const DialogFooter = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      /* Apple's action button layout */
      'flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2',
      /* Spacing */
      'mt-6 gap-3',
      className
    )}
    {...props}
  />
);
DialogFooter.displayName = 'DialogFooter';

/* Dialog title */
const DialogTitle = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title
    ref={ref}
    className={cn(
      /* Apple headline styling */
      'text-lg font-semibold leading-tight tracking-tight text-foreground',
      className
    )}
    {...props}
  />
));
DialogTitle.displayName = DialogPrimitive.Title.displayName;

/* Dialog description */
const DialogDescription = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Description
    ref={ref}
    className={cn(
      /* Apple body text styling */
      'text-sm text-muted-foreground leading-relaxed',
      className
    )}
    {...props}
  />
));
DialogDescription.displayName = DialogPrimitive.Description.displayName;

export {
  Dialog,
  DialogPortal,
  DialogOverlay,
  DialogClose,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogBody,
  DialogFooter,
  DialogTitle,
  DialogDescription,
  dialogContentVariants,
};

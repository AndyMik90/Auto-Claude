import * as React from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { cn } from '../../lib/utils';

/* Apple HIG-inspired full screen dialog component
   Key principles:
   - Large, immersive presentation for complex tasks
   - Smooth animations for open/close
   - Clear close button with proper tap target
   - Rounded corners matching design system
   - Backdrop blur for focus
   - Proper spacing for header, body, and footer
*/

const FullScreenDialog = DialogPrimitive.Root;

const FullScreenDialogTrigger = DialogPrimitive.Trigger;

const FullScreenDialogPortal = DialogPrimitive.Portal;

const FullScreenDialogClose = DialogPrimitive.Close;

const FullScreenDialogOverlay = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    className={cn(
      /* Apple-style backdrop overlay */
      'fixed inset-0 z-50 bg-background/95 backdrop-blur-sm',
      /* Smooth fade animations */
      'data-[state=open]:animate-in data-[state=closed]:animate-out',
      'data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
      /* Apple easing */
      'transition-all duration-200 ease-out',
      className
    )}
    {...props}
  />
));
FullScreenDialogOverlay.displayName = 'FullScreenDialogOverlay';

const FullScreenDialogContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content>
>(({ className, children, ...props }, ref) => (
  <FullScreenDialogPortal>
    <FullScreenDialogOverlay />
    <DialogPrimitive.Content
      ref={ref}
      className={cn(
        /* Apple-style full-screen dialog content */
        'fixed inset-4 z-50 flex flex-col',
        'bg-card border border-border rounded-2xl',
        'shadow-2xl overflow-hidden',
        /* Smooth animations */
        'data-[state=open]:animate-in data-[state=closed]:animate-out',
        'data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
        'data-[state=closed]:zoom-out-98 data-[state=open]:zoom-in-98',
        /* Apple easing */
        'duration-200 ease-out',
        className
      )}
      {...props}
    >
      {children}
      <DialogPrimitive.Close
        className={cn(
          /* Apple-style close button */
          'absolute right-4 top-4 rounded-xl p-2 tap-target',
          'text-muted-foreground hover:text-foreground',
          'hover:bg-accent',
          /* Smooth transitions with Apple easing */
          'transition-all duration-150 ease-out',
          /* Focus ring */
          'focus:outline-none focus:ring-2 focus:ring-ring/40 focus:ring-offset-2 focus:ring-offset-background',
          'disabled:pointer-events-none z-10'
        )}
      >
        <X className="h-5 w-5" />
        <span className="sr-only">Close</span>
      </DialogPrimitive.Close>
    </DialogPrimitive.Content>
  </FullScreenDialogPortal>
));
FullScreenDialogContent.displayName = 'FullScreenDialogContent';

const FullScreenDialogHeader = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      'flex flex-col space-y-1.5 p-6 pb-4 border-b border-border',
      className
    )}
    {...props}
  />
);
FullScreenDialogHeader.displayName = 'FullScreenDialogHeader';

const FullScreenDialogBody = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn('flex-1 overflow-hidden', className)} {...props} />
);
FullScreenDialogBody.displayName = 'FullScreenDialogBody';

const FullScreenDialogFooter = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      'flex items-center justify-end gap-3 p-6 pt-4 border-t border-border',
      className
    )}
    {...props}
  />
);
FullScreenDialogFooter.displayName = 'FullScreenDialogFooter';

const FullScreenDialogTitle = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title
    ref={ref}
    className={cn(
      'text-xl font-semibold leading-none tracking-tight text-foreground',
      className
    )}
    {...props}
  />
));
FullScreenDialogTitle.displayName = 'FullScreenDialogTitle';

const FullScreenDialogDescription = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Description
    ref={ref}
    className={cn('text-sm text-muted-foreground', className)}
    {...props}
  />
));
FullScreenDialogDescription.displayName = 'FullScreenDialogDescription';

export {
  FullScreenDialog,
  FullScreenDialogPortal,
  FullScreenDialogOverlay,
  FullScreenDialogClose,
  FullScreenDialogTrigger,
  FullScreenDialogContent,
  FullScreenDialogHeader,
  FullScreenDialogBody,
  FullScreenDialogFooter,
  FullScreenDialogTitle,
  FullScreenDialogDescription,
};

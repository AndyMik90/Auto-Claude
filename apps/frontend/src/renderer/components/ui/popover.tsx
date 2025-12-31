import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../../lib/utils';

/* Apple HIG-inspired popover component
   Key principles:
   - Non-intrusive positioning with smart placement
   - Smooth enter/exit animations
   - Dismissible on click outside or escape key
   - Glass effect support for liquid glass design
   - Accessible with proper ARIA attributes
*/

type PopoverTriggerElement = HTMLButtonElement;
type PopoverContentElement = HTMLDivElement;

interface PopoverContextValue {
  open: boolean;
  setOpen: (open: boolean) => void;
  triggerRef: React.RefObject<PopoverTriggerElement>;
  contentRef: React.RefObject<PopoverContentElement>;
}

const PopoverContext = React.createContext<PopoverContextValue | undefined>(undefined);

const usePopover = () => {
  const context = React.useContext(PopoverContext);
  if (!context) {
    throw new Error('Popover components must be used within a Popover');
  }
  return context;
};

const popoverVariants = cva(
  'z-50 rounded-xl border shadow-lg transition-all duration-200 ease-out',
  {
    variants: {
      variant: {
        default: 'border-border bg-card text-foreground',
        glass: 'glass-surface border-white/10 dark:border-white/5',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
);

export interface PopoverProps {
  children: React.ReactNode;
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
}

const Popover: React.FC<PopoverProps> = ({
  children,
  open: controlledOpen,
  defaultOpen = false,
  onOpenChange,
}) => {
  const [uncontrolledOpen, setUncontrolledOpen] = React.useState(defaultOpen);
  const triggerRef = React.useRef<PopoverTriggerElement>(null);
  const contentRef = React.useRef<PopoverContentElement>(null);

  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : uncontrolledOpen;

  const setOpen = React.useCallback(
    (newOpen: boolean) => {
      if (!isControlled) {
        setUncontrolledOpen(newOpen);
      }
      onOpenChange?.(newOpen);
    },
    [isControlled, onOpenChange]
  );

  // Close on click outside
  React.useEffect(() => {
    if (!open) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (
        contentRef.current &&
        !contentRef.current.contains(event.target as Node) &&
        triggerRef.current &&
        !triggerRef.current.contains(event.target as Node)
      ) {
        setOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open, setOpen]);

  // Close on escape key
  React.useEffect(() => {
    if (!open) return;

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [open, setOpen]);

  return (
    <PopoverContext.Provider value={{ open, setOpen, triggerRef, contentRef }}>
      {children}
    </PopoverContext.Provider>
  );
};
Popover.displayName = 'Popover';

export interface PopoverTriggerProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  asChild?: boolean;
}

const PopoverTrigger = React.forwardRef<HTMLButtonElement, PopoverTriggerProps>(
  ({ className, asChild = false, children, ...props }, ref) => {
    const { open, setOpen, triggerRef } = usePopover();
    const internalRef = React.useRef<HTMLButtonElement>(null);

    // Merge refs
    React.useImperativeHandle(ref, () => internalRef.current!);
    React.useEffect(() => {
      triggerRef.current = internalRef.current;
    }, [triggerRef]);

    const handleClick = () => {
      setOpen(!open);
    };

    if (asChild && React.isValidElement(children)) {
      return React.cloneElement(children as React.ReactElement<any>, {
        ref: internalRef,
        onClick: handleClick,
        'aria-haspopup': 'dialog',
        'aria-expanded': open,
      });
    }

    return (
      <button
        ref={internalRef}
        type="button"
        className={cn(
          'inline-flex items-center justify-center tap-target',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
          'disabled:pointer-events-none disabled:opacity-50',
          className
        )}
        onClick={handleClick}
        aria-haspopup="dialog"
        aria-expanded={open}
        {...props}
      >
        {children}
      </button>
    );
  }
);
PopoverTrigger.displayName = 'PopoverTrigger';

export interface PopoverContentProps extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof popoverVariants> {
  align?: 'start' | 'center' | 'end';
  sideOffset?: number;
}

const PopoverContent = React.forwardRef<HTMLDivElement, PopoverContentProps>(
  ({ className, variant = 'default', align = 'center', sideOffset = 8, children, style, ...props }, ref) => {
    const { open, triggerRef, contentRef } = usePopover();
    const internalRef = React.useRef<HTMLDivElement>(null);
    const [position, setPosition] = React.useState({ top: 0, left: 0 });

    // Merge refs
    React.useImperativeHandle(ref, () => internalRef.current!);
    React.useEffect(() => {
      contentRef.current = internalRef.current;
    }, [contentRef]);

    // Calculate position
    React.useEffect(() => {
      if (!open || !triggerRef.current || !internalRef.current) return;

      const triggerRect = triggerRef.current.getBoundingClientRect();
      const contentRect = internalRef.current.getBoundingClientRect();
      const scrollY = window.scrollY || window.pageYOffset;
      const scrollX = window.scrollX || window.pageXOffset;

      let top = triggerRect.top + scrollY - contentRect.height - sideOffset;
      let left = triggerRect.left + scrollX;

      // Adjust for alignment
      if (align === 'center') {
        left += triggerRect.width / 2 - contentRect.width / 2;
      } else if (align === 'end') {
        left += triggerRect.width - contentRect.width;
      }

      // Check if popover would go off screen at top
      if (top < 0) {
        top = triggerRect.bottom + scrollY + sideOffset;
      }

      // Check if popover would go off screen at sides
      if (left < 0) {
        left = Math.max(8, scrollX + 8);
      }
      if (left + contentRect.width > window.innerWidth) {
        left = window.innerWidth - contentRect.width - 8;
      }

      setPosition({ top, left });
    }, [open, align, sideOffset]);

    if (!open) return null;

    return (
      <div
        ref={internalRef}
        className={cn(
          popoverVariants({ variant }),
          'absolute min-w-[8rem] p-4',
          'data-[state=open]:animate-in data-[state=closed]:animate-out',
          'data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
          'data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95',
          className
        )}
        style={{ ...position, ...style }}
        role="dialog"
        aria-modal="false"
        {...props}
      >
        {children}
      </div>
    );
  }
);
PopoverContent.displayName = 'PopoverContent';

// Compound sub-components
const PopoverHeader = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn('flex flex-col space-y-1.5 mb-4', className)}
    {...props}
  />
));
PopoverHeader.displayName = 'PopoverHeader';

const PopoverTitle = React.forwardRef<
  HTMLHeadingElement,
  React.HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => (
  <h4
    ref={ref}
    className={cn('text-lg font-semibold leading-none tracking-tight', className)}
    {...props}
  />
));
PopoverTitle.displayName = 'PopoverTitle';

const PopoverDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <p
    ref={ref}
    className={cn('text-sm text-muted-foreground', className)}
    {...props}
  />
));
PopoverDescription.displayName = 'PopoverDescription';

const PopoverFooter = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn('flex items-center mt-4 pt-4 border-t border-border', className)}
    {...props}
  />
));
PopoverFooter.displayName = 'PopoverFooter';

const PopoverClose = React.forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement>
>(({ className, ...props }, ref) => {
  const { setOpen } = usePopover();

  return (
    <button
      ref={ref}
      type="button"
      className={cn(
        'rounded-md px-3 py-1.5 text-sm font-medium',
        'hover:bg-accent hover:text-accent-foreground',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        'transition-colors duration-150',
        className
      )}
      onClick={() => setOpen(false)}
      {...props}
    />
  );
});
PopoverClose.displayName = 'PopoverClose';

export {
  Popover,
  PopoverTrigger,
  PopoverContent,
  PopoverHeader,
  PopoverTitle,
  PopoverDescription,
  PopoverFooter,
  PopoverClose,
  popoverVariants,
};

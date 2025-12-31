import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../../lib/utils';

/* Apple HIG-inspired accordion component
   Key principles:
   - Smooth expand/collapse animations
   - 44pt tap targets for accessibility
   - Proper ARIA attributes
   - Support for single and multiple accordion types
*/

const accordionVariants = cva(
  'rounded-lg tap-target',
  {
    variants: {
      variant: {
        default: 'border border-border',
        ghost: 'border-0',
        glass: 'glass-surface',
      },
      size: {
        sm: 'text-sm',
        md: 'text-base',
        lg: 'text-lg',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'md',
    },
  }
);

const accordionItemVariants = cva(
  'border-b last:border-b-0',
  {
    variants: {
      variant: {
        default: '',
        ghost: '',
        glass: 'border-white/10 dark:border-white/5',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
);

const accordionTriggerVariants = cva(
  'flex flex-1 items-center justify-between py-4 font-medium transition-all hover:underline [&[data-state=open]>svg]:rotate-180',
  {
    variants: {
      size: {
        sm: 'py-2 px-3 text-sm',
        md: 'py-3 px-4 text-base',
        lg: 'py-4 px-5 text-lg',
      },
    },
    defaultVariants: {
      size: 'md',
    },
  }
);

const accordionContentVariants = cva(
  'overflow-hidden text-sm transition-all duration-300 ease-in-out',
  {
    variants: {
      animation: {
        none: '',
        slide: 'data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down',
        fade: 'data-[state=closed]:opacity-0 data-[state=open]:opacity-100',
      },
    },
    defaultVariants: {
      animation: 'slide',
    },
  }
);

export interface AccordionProps extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof accordionVariants> {
  type?: 'single' | 'multiple';
  value?: string | string[];
  defaultValue?: string | string[];
  onValueChange?: (value: string | string[]) => void;
  collapsible?: boolean;
}

export interface AccordionItemProps extends React.HTMLAttributes<HTMLDivElement> {
  value: string;
}

export interface AccordionTriggerProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  value: string;
}

export interface AccordionContentProps extends React.HTMLAttributes<HTMLDivElement> {
  value: string;
}

// Context for Accordion state management
interface AccordionContextValue {
  value: string | string[];
  onValueChange: (value: string | string[]) => void;
  type: 'single' | 'multiple';
  collapsible: boolean;
}

const AccordionContext = React.createContext<AccordionContextValue | undefined>(undefined);

const useAccordionContext = () => {
  const context = React.useContext(AccordionContext);
  if (!context) {
    throw new Error('Accordion components must be used within an Accordion');
  }
  return context;
};

const Accordion = React.forwardRef<HTMLDivElement, AccordionProps>(
  (
    {
      className,
      value: controlledValue,
      defaultValue = '',
      onValueChange,
      type = 'single',
      collapsible = true,
      variant = 'default',
      size = 'md',
      children,
      ...props
    },
    ref
  ) => {
    const [uncontrolledValue, setUncontrolledValue] = React.useState<string | string[]>(defaultValue);
    const isControlled = controlledValue !== undefined;
    const value = isControlled ? controlledValue : uncontrolledValue;

    const handleValueChange = (newValue: string | string[]) => {
      if (!isControlled) {
        setUncontrolledValue(newValue);
      }
      onValueChange?.(newValue);
    };

    const toggleItem = (itemValue: string) => {
      if (type === 'single') {
        const currentValue = Array.isArray(value) ? value[0] : value;
        if (currentValue === itemValue && collapsible) {
          handleValueChange('');
        } else {
          handleValueChange(itemValue);
        }
      } else {
        const currentValueArray = Array.isArray(value) ? value : [];
        if (currentValueArray.includes(itemValue)) {
          if (collapsible || currentValueArray.length > 1) {
            handleValueChange(currentValueArray.filter((v) => v !== itemValue));
          }
        } else {
          handleValueChange([...currentValueArray, itemValue]);
        }
      }
    };

    const isItemOpen = (itemValue: string) => {
      if (type === 'single') {
        const currentValue = Array.isArray(value) ? value[0] : value;
        return currentValue === itemValue;
      }
      return Array.isArray(value) && value.includes(itemValue);
    };

    return (
      <AccordionContext.Provider value={{ value, onValueChange: toggleItem, type, collapsible }}>
        <div
          ref={ref}
          className={cn(accordionVariants({ variant, size }), className)}
          {...props}
        >
          {React.Children.map(children, (child) => {
            if (React.isValidElement(child)) {
              return React.cloneElement(child as React.ReactElement<any>, {
                isItemOpen,
              });
            }
            return child;
          })}
        </div>
      </AccordionContext.Provider>
    );
  }
);
Accordion.displayName = 'Accordion';

const AccordionItem = React.forwardRef<HTMLDivElement, AccordionItemProps>(
  ({ className, value: itemValue, isItemOpen, children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(accordionItemVariants(), className)}
        data-state={isItemOpen?.(itemValue) ? 'open' : 'closed'}
        {...props}
      >
        {React.Children.map(children, (child) => {
          if (React.isValidElement(child)) {
            return React.cloneElement(child as React.ReactElement<any>, {
              itemValue,
            });
          }
          return child;
        })}
      </div>
    );
  }
);
AccordionItem.displayName = 'AccordionItem';

const AccordionTrigger = React.forwardRef<HTMLButtonElement, AccordionTriggerProps>(
  ({ className, itemValue, children, ...props }, ref) => {
    const { onValueChange, type } = useAccordionContext();
    const context = React.useContext(AccordionContext);

    const isOpen = context?.type === 'single'
      ? (Array.isArray(context.value) ? context.value[0] : context.value) === itemValue
      : Array.isArray(context.value) && context.value.includes(itemValue);

    return (
      <button
        ref={ref}
        aria-expanded={isOpen}
        data-state={isOpen ? 'open' : 'closed'}
        className={cn(accordionTriggerVariants(), 'w-full text-left', className)}
        onClick={() => onValueChange(itemValue)}
        {...props}
      >
        {children}
        <svg
          className="h-4 w-4 shrink-0 transition-transform duration-200"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </button>
    );
  }
);
AccordionTrigger.displayName = 'AccordionTrigger';

const AccordionContent = React.forwardRef<HTMLDivElement, AccordionContentProps>(
  ({ className, itemValue, children, animation = 'slide', ...props }, ref) => {
    const contentRef = React.useRef<HTMLDivElement>(null);
    const [height, setHeight] = React.useState<number | 'auto'>(0);

    const context = React.useContext(AccordionContext);
    const isOpen = context?.type === 'single'
      ? (Array.isArray(context.value) ? context.value[0] : context.value) === itemValue
      : Array.isArray(context.value) && context.value.includes(itemValue);

    React.useEffect(() => {
      if (contentRef.current) {
        if (isOpen) {
          const scrollHeight = contentRef.current.scrollHeight;
          setHeight(scrollHeight);
        } else {
          setHeight(0);
        }
      }
    }, [isOpen]);

    return (
      <div
        ref={ref}
        className={cn(accordionContentVariants({ animation }))}
        data-state={isOpen ? 'open' : 'closed'}
        style={{
          height: typeof height === 'number' ? `${height}px` : height,
        }}
        {...props}
      >
        <div ref={contentRef} className="pb-4 pt-0">
          {children}
        </div>
      </div>
    );
  }
);
AccordionContent.displayName = 'AccordionContent';

// Additional sub-components for compound API
const AccordionHeader = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn('flex items-center', className)} {...props} />
));
AccordionHeader.displayName = 'AccordionHeader';

const AccordionTitle = React.forwardRef<
  HTMLHeadingElement,
  React.HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => (
  <h4 ref={ref} className={cn('font-semibold', className)} {...props} />
));
AccordionTitle.displayName = 'AccordionTitle';

const AccordionDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <p ref={ref} className={cn('text-sm text-muted-foreground', className)} {...props} />
));
AccordionDescription.displayName = 'AccordionDescription';

export {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
  AccordionHeader,
  AccordionTitle,
  AccordionDescription,
  accordionVariants,
  accordionItemVariants,
  accordionTriggerVariants,
  accordionContentVariants,
};

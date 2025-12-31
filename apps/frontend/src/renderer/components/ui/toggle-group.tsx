import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../../lib/utils';

/* Apple HIG-inspired toggle group component
   Key principles:
   - Mutually exclusive or multi-select options
   - 44pt tap targets for accessibility
   - Smooth transitions with visual feedback
   - Support for single and multiple selection modes
*/

const toggleGroupVariants = cva(
  'inline-flex items-center justify-center rounded-lg tap-target bg-muted p-1 gap-1',
  {
    variants: {
      size: {
        sm: 'p-0.5 gap-0.5',
        md: 'p-1 gap-1',
        lg: 'p-1.5 gap-1.5',
      },
      orientation: {
        horizontal: 'flex-row',
        vertical: 'flex-col',
      },
      variant: {
        default: '',
        glass: 'glass-surface',
      },
    },
    defaultVariants: {
      size: 'md',
      orientation: 'horizontal',
      variant: 'default',
    },
  }
);

const toggleItemVariants = cva(
  'inline-flex items-center justify-center whitespace-nowrap rounded-md transition-all duration-200 font-medium',
  {
    variants: {
      size: {
        sm: 'h-8 px-2 text-xs',
        md: 'h-10 px-3 text-sm',
        lg: 'h-12 px-4 text-base',
      },
      selected: {
        true: 'bg-background text-foreground shadow-sm',
        false: 'text-muted-foreground hover:text-foreground hover:bg-muted-foreground/10',
      },
      disabled: {
        true: 'opacity-50 cursor-not-allowed pointer-events-none',
        false: '',
      },
    },
    defaultVariants: {
      size: 'md',
      selected: false,
      disabled: false,
    },
  }
);

export interface ToggleGroupProps extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof toggleGroupVariants> {
  value?: string | string[];
  defaultValue?: string | string[];
  onValueChange?: (value: string | string[]) => void;
  type?: 'single' | 'multiple';
  disabled?: boolean;
}

export interface ToggleGroupItemProps extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'value' | 'disabled'> {
  value: string;
  selected?: boolean;
  size?: VariantProps<typeof toggleItemVariants>['size'];
}

const ToggleGroupContext = React.createContext<{
  value: string | string[];
  onValueChange: (value: string | string[]) => void;
  type: 'single' | 'multiple';
  disabled: boolean;
  size: VariantProps<typeof toggleGroupVariants>['size'];
}>({
  value: '',
  onValueChange: () => {},
  type: 'single',
  disabled: false,
  size: 'md',
});

const ToggleGroup = React.forwardRef<HTMLDivElement, ToggleGroupProps>(
  (
    {
      className,
      value: controlledValue,
      defaultValue = '',
      onValueChange,
      type = 'single',
      disabled = false,
      size = 'md',
      orientation = 'horizontal',
      variant = 'default',
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

    return (
      <ToggleGroupContext.Provider
        value={{ value, onValueChange: handleValueChange, type, disabled, size }}
      >
        <div
          ref={ref}
          role="group"
          aria-disabled={disabled}
          className={cn(toggleGroupVariants({ size, orientation, variant }), disabled && 'opacity-50', className)}
          {...props}
        >
          {children}
        </div>
      </ToggleGroupContext.Provider>
    );
  }
);
ToggleGroup.displayName = 'ToggleGroup';

const ToggleGroupItem = React.forwardRef<HTMLButtonElement, ToggleGroupItemProps>(
  ({ className, value: itemValue, selected: controlledSelected, size, disabled: itemDisabled, ...props }, ref) => {
    const context = React.useContext(ToggleGroupContext);
    const itemSize = size ?? context.size;

    if (!context) {
      throw new Error('ToggleGroupItem must be used within a ToggleGroup');
    }

    const isSelected = controlledSelected ?? (
      context.type === 'single'
        ? context.value === itemValue
        : Array.isArray(context.value) && context.value.includes(itemValue)
    );

    const handleClick = () => {
      if (context.disabled || itemDisabled) return;

      if (context.type === 'single') {
        context.onValueChange(itemValue);
      } else {
        const currentArray = Array.isArray(context.value) ? context.value : [];
        if (currentArray.includes(itemValue)) {
          context.onValueChange(currentArray.filter((v) => v !== itemValue));
        } else {
          context.onValueChange([...currentArray, itemValue]);
        }
      }
    };

    const handleKeyDown = (event: React.KeyboardEvent) => {
      if (context.disabled || itemDisabled) return;

      switch (event.key) {
        case 'ArrowLeft':
        case 'ArrowUp':
          event.preventDefault();
          // Focus previous sibling
          (event.target as HTMLElement).previousElementSibling?.querySelector('button')?.focus();
          break;
        case 'ArrowRight':
        case 'ArrowDown':
          event.preventDefault();
          // Focus next sibling
          (event.target as HTMLElement).nextElementSibling?.querySelector('button')?.focus();
          break;
        case ' ':
        case 'Enter':
          event.preventDefault();
          handleClick();
          break;
      }
    };

    return (
      <button
        ref={ref}
        type="button"
        role={context.type === 'single' ? 'radio' : 'checkbox'}
        aria-checked={isSelected}
        aria-disabled={context.disabled || itemDisabled}
        disabled={context.disabled || itemDisabled}
        className={cn(
          toggleItemVariants({
            size: itemSize,
            selected: isSelected,
            disabled: context.disabled || itemDisabled,
          }),
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
          className
        )}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        {...props}
      />
    );
  }
);
ToggleGroupItem.displayName = 'ToggleGroupItem';

// Additional sub-components for compound API
const ToggleGroupLabel = React.forwardRef<
  HTMLSpanElement,
  React.HTMLAttributes<HTMLSpanElement>
>(({ className, ...props }, ref) => (
  <span
    ref={ref}
    className={cn('text-sm font-medium text-muted-foreground mb-1.5 block', className)}
    {...props}
  />
));
ToggleGroupLabel.displayName = 'ToggleGroupLabel';

const ToggleGroupSeparator = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, orientation = 'horizontal', ...props }, ref) => (
  <div
    ref={ref}
    role="separator"
    aria-orientation={orientation}
    className={cn(
      'bg-border',
      orientation === 'horizontal' ? 'w-px h-full' : 'h-px w-full',
      className
    )}
    {...props}
  />
));
ToggleGroupSeparator.displayName = 'ToggleGroupSeparator';

export {
  ToggleGroup,
  ToggleGroupItem,
  ToggleGroupLabel,
  ToggleGroupSeparator,
  toggleGroupVariants,
  toggleItemVariants,
};

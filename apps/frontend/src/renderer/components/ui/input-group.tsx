import * as React from 'react';
import { cn } from '../../lib/utils';
import { Input } from './input';

/* Apple HIG-inspired input group compound component
   Key principles:
   - 44pt minimum tap targets
   - Smooth transitions with Apple easing
   - Clear visual hierarchy
   - Proper semantic HTML
   Patterns: InputGroup > InputLabel, Input, InputHint, InputError, InputIcon
*/

interface InputGroupContextValue {
  id: string;
  error?: string;
  disabled?: boolean;
}

const InputGroupContext = React.createContext<InputGroupContextValue>({
  id: '',
});

const InputGroup = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & { id?: string }
>(({ className, id, children, ...props }, ref) => {
  const groupId = id || React.useId();

  return (
    <InputGroupContext.Provider value={{ id: groupId }}>
      <div
        ref={ref}
        className={cn('space-y-2', className)}
        {...props}
      >
        {children}
      </div>
    </InputGroupContext.Provider>
  );
});
InputGroup.displayName = 'InputGroup';

const InputLabel = React.forwardRef<
  HTMLLabelElement,
  React.LabelHTMLAttributes<HTMLLabelElement>
>(({ className, htmlFor, ...props }, ref) => {
  const { id } = React.useContext(InputGroupContext);

  return (
    <label
      ref={ref}
      htmlFor={htmlFor || id}
      className={cn(
        'text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70',
        'text-foreground',
        className
      )}
      {...props}
    />
  );
});
InputLabel.displayName = 'InputLabel';

const InputHint = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <p
    ref={ref}
    className={cn('text-sm text-muted-foreground', className)}
    {...props}
  />
));
InputHint.displayName = 'InputHint';

const InputError = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <p
    ref={ref}
    className={cn('text-sm text-destructive font-medium', className)}
    {...props}
  />
));
InputError.displayName = 'InputError';

const InputIcon = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn('absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none', className)}
    {...props}
  />
));
InputIcon.displayName = 'InputIcon';

export { InputGroup, InputLabel, InputHint, InputError, InputIcon, Input };

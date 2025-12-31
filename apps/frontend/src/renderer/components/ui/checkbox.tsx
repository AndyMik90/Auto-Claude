import * as React from 'react';
import * as CheckboxPrimitive from '@radix-ui/react-checkbox';
import { Check } from 'lucide-react';
import { cn } from '../../lib/utils';

/* Apple HIG-inspired checkbox component
   Key principles:
   - Square with slightly rounded corners for modern appearance
   - Clear visual feedback for checked/unchecked states
   - Smooth transitions for state changes
   - Proper focus ring for accessibility
   - 22pt minimum tap target when wrapped
*/

const Checkbox = React.forwardRef<
  React.ElementRef<typeof CheckboxPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof CheckboxPrimitive.Root>
>(({ className, ...props }, ref) => (
  <CheckboxPrimitive.Root
    ref={ref}
    className={cn(
      /* Apple-style checkbox: square with rounded corners */
      'peer h-4 w-4 shrink-0 rounded-md border border-primary ring-offset-background',
      /* Focus state - Apple's subtle ring */
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:ring-offset-2',
      /* Disabled state */
      'disabled:cursor-not-allowed disabled:opacity-50',
      /* Checked state */
      'data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground',
      /* Smooth transitions with Apple easing */
      'transition-all duration-150 ease-out',
      className
    )}
    {...props}
  >
    <CheckboxPrimitive.Indicator
      className={cn('flex items-center justify-center text-current')}
    >
      <Check className="h-3 w-3" />
    </CheckboxPrimitive.Indicator>
  </CheckboxPrimitive.Root>
));
Checkbox.displayName = CheckboxPrimitive.Root.displayName;

export { Checkbox };

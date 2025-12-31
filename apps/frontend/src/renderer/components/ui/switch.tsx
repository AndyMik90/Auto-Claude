import * as React from 'react';
import * as SwitchPrimitives from '@radix-ui/react-switch';
import { cn } from '../../lib/utils';

/* Apple HIG-inspired switch component
   Key principles:
   - Rounded track with smooth thumb animation
   - 44pt height for touch targets (wrapper)
   - Smooth spring animation for thumb movement
   - Clear visual feedback for checked/unchecked states
*/
const Switch = React.forwardRef<
  React.ElementRef<typeof SwitchPrimitives.Root>,
  React.ComponentPropsWithoutRef<typeof SwitchPrimitives.Root>
>(({ className, ...props }, ref) => (
  <SwitchPrimitives.Root
    className={cn(
      /* Apple-style track: rounded pill shape */
      'peer inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full',
      'border-2 border-transparent',
      /* Smooth transitions with Apple easing */
      'transition-all duration-200 ease-out',
      /* Focus ring */
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
      /* Disabled state */
      'disabled:cursor-not-allowed disabled:opacity-50',
      /* Checked/unchecked colors */
      'data-[state=checked]:bg-primary data-[state=unchecked]:bg-border',
      className
    )}
    {...props}
    ref={ref}
  >
    <SwitchPrimitives.Thumb
      className={cn(
        /* Apple-style thumb: circular with shadow */
        'pointer-events-none block h-5 w-5 rounded-full shadow-sm ring-0',
        /* Smooth spring-like transition */
        'transition-transform duration-200 ease-out',
        'bg-white dark:bg-foreground',
        /* Thumb position animation */
        'data-[state=checked]:translate-x-5 data-[state=unchecked]:translate-x-0',
        /* Thumb color when checked */
        'data-[state=checked]:bg-primary-foreground'
      )}
    />
  </SwitchPrimitives.Root>
));
Switch.displayName = SwitchPrimitives.Root.displayName;

export { Switch };

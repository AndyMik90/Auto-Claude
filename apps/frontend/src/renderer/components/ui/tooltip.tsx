import * as React from 'react';
import * as TooltipPrimitive from '@radix-ui/react-tooltip';
import { cn } from '../../lib/utils';

/* Apple HIG-inspired tooltip component
   Key principles:
   - Subtle, non-intrusive appearance
   - Smooth fade and scale animations
   - Proper positioning relative to target
   - Clear text with adequate contrast
   - Rounded corners matching design system
   - Brief delay before appearance for intentional hover
*/

const TooltipProvider = TooltipPrimitive.Provider;

const Tooltip = TooltipPrimitive.Root;

const TooltipTrigger = TooltipPrimitive.Trigger;

const TooltipContent = React.forwardRef<
  React.ElementRef<typeof TooltipPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TooltipPrimitive.Content>
>(({ className, sideOffset = 4, ...props }, ref) => (
  <TooltipPrimitive.Content
    ref={ref}
    sideOffset={sideOffset}
    className={cn(
      /* Apple-style tooltip appearance */
      'z-50 overflow-hidden rounded-lg border border-border bg-card px-3 py-1.5 text-sm text-foreground shadow-lg',
      /* Smooth enter/exit animations */
      'animate-in fade-in-0 zoom-in-95',
      'data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95',
      /* Slide animations based on position */
      'data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2',
      'data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2',
      /* Apple easing for smooth transitions */
      'transition-all duration-150 ease-out',
      className
    )}
    {...props}
  />
));
TooltipContent.displayName = TooltipPrimitive.Content.displayName;

export { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider };

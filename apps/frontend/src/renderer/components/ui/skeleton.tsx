/* Apple HIG-inspired skeleton component
   Key principles:
   - Subtle shimmer animation for loading states
   - Rounded corners matching design system
   - Smooth transitions with Apple easing
   - Used as placeholder for content loading
   - Matches surrounding content layout
*/

import * as React from "react"
import { cn } from "@/lib/utils"

function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        /* Apple-style skeleton base */
        "animate-pulse rounded-md bg-muted",
        /* Apple shimmer effect - faster than default pulse */
        "duration-200 ease-out",
        className
      )}
      {...props}
    />
  )
}

export { Skeleton }

# Task 5: Typography Utilities & Skeleton Component

## Files to Create:

### 1. typography.css
**Path**: `apps/frontend/src/renderer/styles/typography.css`

Create Apple HIG typography tokens:
```css
/**
 * Apple HIG Typography Scale
 * Based on SF Pro font system and Dynamic Type
 */

/* Font Weights */
:root {
  --font-weight-regular: 400;    /* body, body-emphasized */
  --font-weight-medium: 500;     /* caption1, caption2, footnote, subheadline */
  --font-weight-semibold: 600;   /* headline, title1, title2, title3, largeTitle */
}

/* Text Sizes - SF Pro Scale */
:root {
  --text-xs: 11px;      /* caption2, footnote */
  --text-sm: 13px;      /* subheadline, footnote, caption1 */
  --text-base: 17px;    /* body, callout, headline */
  --text-lg: 20px;      /* body-emphasized, title3 */
  --text-xl: 22px;      /* title2 */
  --text-2xl: 28px;     /* title1 */
  --text-3xl: 34px;     /* largeTitle */
}

/* Line Heights - Apple's breathable spacing */
:root {
  --leading-xs: 16px;
  --leading-sm: 18px;
  --leading-base: 22px;
  --leading-lg: 25px;
  --leading-xl: 28px;
  --leading-2xl: 34px;
  --leading-3xl: 41px;
}
```

### 2. skeleton.tsx
**Path**: `apps/frontend/src/renderer/components/ui/skeleton.tsx`

Create Apple-style skeleton component:
```tsx
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
```

## Import the typography.css
Add import to main CSS file (check existing styles structure):
```css
@import './typography.css';
```

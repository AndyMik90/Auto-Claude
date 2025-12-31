# Task 7: Utilities CSS Files

## Files to Create:

### 1. safe-area.css
**Path**: `apps/frontend/src/renderer/styles/safe-area.css`

```css
/**
 * Apple HIG Safe Area Support
 * Handles notched devices and iOS Safari browser chrome
 */

/* Safe area insets for main app container */
.safe-area {
  padding-top: env(safe-area-inset-top, 0px);
  padding-right: env(safe-area-inset-right, 0px);
  padding-bottom: env(safe-area-inset-bottom, 0px);
  padding-left: env(safe-area-inset-left, 0px);
}

/* Safe area for fixed elements (headers, sidebars) */
.safe-area-fixed-top {
  padding-top: env(safe-area-inset-top, 0px);
}

.safe-area-fixed-bottom {
  padding-bottom: env(safe-area-inset-bottom, 0px);
}
```

### 2. animations.css
**Path**: `apps/frontend/src/renderer/styles/animations.css`

```css
/**
 * Apple HIG Staggered Animations
 * Sequential reveal for list items and cards
 */

@keyframes apple-reveal {
  from {
    opacity: 0;
    transform: translateY(8px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.apple-reveal-stagger {
  animation: apple-reveal 0.2s ease-out backwards;
}

/* Stagger delays (applied via inline style or nth-child) */
.stagger-1 { animation-delay: 0ms; }
.stagger-2 { animation-delay: 50ms; }
.stagger-3 { animation-delay: 100ms; }
.stagger-4 { animation-delay: 150ms; }
.stagger-5 { animation-delay: 200ms; }
.stagger-6 { animation-delay: 250ms; }
```

### 3. Update globals.css
**Path**: `apps/frontend/src/renderer/styles/globals.css`

Add shimmer keyframes:
```css
@keyframes shimmer {
  0% {
    background-position: -200% 0;
  }
  100% {
    background-position: 200% 0;
  }
}

.animate-apple-shimmer {
  animation: shimmer 1.5s ease-in-out infinite;
  background: linear-gradient(
    90deg,
    hsl(var(--muted)) 0%,
    hsl(var(--muted) / 0.5) 50%,
    hsl(var(--muted)) 100%
  );
  background-size: 200% 100%;
}
```

## Import CSS files
Add imports to main CSS file:
```css
@import './safe-area.css';
@import './animations.css';
```

# Task 8: Apply Utilities to Components

## Files to Update:

### 1. App.tsx
**Path**: `apps/frontend/src/renderer/App.tsx`

Add `safe-area` class to root container for notched device support.

### 2. SortableTaskCard.tsx
**Path**: `apps/frontend/src/renderer/components/SortableTaskCard.tsx`

Apply staggered reveal animations:
- Add `apple-reveal-stagger` class
- Add inline style with `animationDelay` based on index

### 3. TerminalGrid.tsx
**Path**: `apps/frontend/src/renderer/components/TerminalGrid.tsx`

Apply staggered reveal animations:
- Add `apple-reveal-stagger` class
- Add inline style with `animationDelay` based on index

## Implementation Pattern:
```tsx
// For list items with staggered animation
<div
  className="apple-reveal-stagger"
  style={{ animationDelay: `${index * 50}ms` }}
>
  {/* content */}
</div>
```

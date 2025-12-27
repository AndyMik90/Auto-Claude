# Accessibility Testing Guide

This guide provides instructions for testing the AutoClaude Mobile app with VoiceOver (iOS) and TalkBack (Android) screen readers.

## Overview

All interactive components in this app include:
- `accessibilityLabel` - Descriptive text read by screen readers
- `accessibilityHint` - Additional context for actions
- `accessibilityRole` - Semantic role (button, text, progressbar, etc.)
- `accessibilityState` - State information (disabled, selected, etc.)

## Testing with VoiceOver (iOS)

### Enable VoiceOver

1. Go to **Settings > Accessibility > VoiceOver**
2. Toggle **VoiceOver** on
3. Alternatively, triple-click the side button (if configured)

### Basic Navigation

- **Swipe right**: Move to next element
- **Swipe left**: Move to previous element
- **Double-tap**: Activate selected element
- **Three-finger swipe**: Scroll

### Testing Checklist

#### Home Screen (Kanban Board)
- [ ] Task summary reads column counts (e.g., "3 tasks in Backlog, 2 tasks in Progress")
- [ ] Each task card reads: "Task: [title]. Status: [status]. Priority: [priority]. Complexity: X out of 10"
- [ ] Task cards announce "Double tap to view task details. Long press for quick actions"
- [ ] Kanban columns announce "X column with Y tasks"

#### Projects Screen
- [ ] Each project item reads project name, status, task progress
- [ ] Progress bar announces completion percentage
- [ ] Status badges announce their meaning

#### Chat Screen
- [ ] Messages announce role (You/Assistant) and content
- [ ] Streaming messages announce "currently typing"
- [ ] Tool usage chips announce tool name and status

#### GitHub Screen
- [ ] Issues/PRs announce number, title, state, and key details
- [ ] Action buttons announce their purpose ("Investigate issue", "Auto-fix issue")
- [ ] Status indicators announce their state ("AI investigation in progress")
- [ ] Merge status announces readiness ("Ready to merge" or "Has conflicts")

#### Settings Screen
- [ ] All toggles announce their current state
- [ ] Connection status announces current state
- [ ] Buttons announce their purpose with hints

#### Terminal Screen
- [ ] Terminal list items announce session name, status, and output line count
- [ ] Terminal output lines announce content with appropriate context
- [ ] Auto-scroll toggle announces current state

## Testing with TalkBack (Android)

### Enable TalkBack

1. Go to **Settings > Accessibility > TalkBack**
2. Toggle **Use TalkBack** on
3. Alternatively, hold both volume buttons for 3 seconds

### Basic Navigation

- **Swipe right**: Move to next element
- **Swipe left**: Move to previous element
- **Double-tap**: Activate selected element
- **Two-finger swipe**: Scroll

### Testing Checklist

Use the same checklist as VoiceOver above. Key differences:

- TalkBack uses different gesture patterns
- Focus indicators may appear different
- Some roles may be announced differently

## Common Accessibility Patterns Used

### Interactive Elements

```tsx
<Pressable
  accessibilityLabel="Descriptive label"
  accessibilityRole="button"
  accessibilityHint="What happens when you tap"
  accessibilityState={{ disabled: false, selected: isSelected }}
>
```

### Progress Indicators

```tsx
<View
  accessibilityLabel="Loading"
  accessibilityRole="progressbar"
  accessibilityValue={{ min: 0, max: 100, now: 50 }}
>
```

### Status Elements

```tsx
<View
  accessibilityLabel="Status: Connected"
  accessibilityRole="text"
>
```

### Live Regions (Dynamic Content)

```tsx
<View
  accessibilityLiveRegion="polite"
  accessibilityRole="alert"
>
```

## Components with Accessibility Support

| Component | Labels | Hints | Roles | States |
|-----------|--------|-------|-------|--------|
| TaskCard | Yes | Yes | button | disabled, selected |
| KanbanColumn | Yes | - | list | - |
| KanbanBoard | Yes | - | scrollbar, summary | - |
| ChatMessage | Yes | Yes | text, button | - |
| TerminalOutput | Yes | Yes | scrollbar, progressbar | - |
| TerminalLine | Yes | - | text | - |
| ProjectListItem | Yes | Yes | button | disabled, selected |
| EmptyState | Yes | Yes | text, button | - |
| LoadingIndicator | Yes | - | progressbar | - |
| ErrorMessage | Yes | Yes | alert | - |
| Badge | Yes | - | text | - |
| Header | Yes | Yes | header, button | - |
| IssueListItem | Yes | Yes | button | disabled |
| PRListItem | Yes | Yes | button | disabled |
| TerminalListItem | Yes | Yes | button | disabled, selected |
| ConnectionStatus | Yes | Yes | button | - |

## Reporting Issues

If you find accessibility issues:

1. Note the component and screen
2. Describe what VoiceOver/TalkBack announces
3. Describe what it should announce
4. Include device/OS version

## Best Practices

1. **Don't over-describe**: Keep labels concise but informative
2. **Use hints sparingly**: Only for non-obvious actions
3. **Test with real users**: Automated testing can't catch all issues
4. **Consider focus order**: Elements should be focused in logical order
5. **Test with reduced motion**: Some users disable animations
6. **Hide decorative elements**: Use `accessibilityElementsHidden` for visual-only content
7. **Announce dynamic content**: Use `accessibilityLiveRegion` for updates

## Review History

### Phase 7.3 Review (Latest)
All 15 components in `apps/mobile/components/` were audited for accessibility:
- **TaskCard**: Comprehensive (label, hint, role, state, value)
- **KanbanColumn**: Good (label, role on container and list)
- **KanbanBoard**: Good (summary, role, live region for drag hints)
- **ChatMessage**: Good (label, role, streaming state announcement)
- **TerminalOutput**: Good (label, role, scroll controls)
- **ProjectListItem**: Comprehensive (label, hint, role, state)
- **EmptyState**: Good (label, role, action button hints)
- **LoadingIndicator**: Good (label, role as progressbar)
- **ErrorMessage**: Good (label, role as alert, severity prefix)
- **Badge**: Good (label, role, hidden icons)
- **Header**: Enhanced (modal header now has role and label)
- **TerminalListItem**: Comprehensive (label, hint, role, state)
- **ConnectionStatus**: Enhanced (pulse indicator now hidden)
- **PRListItem**: Comprehensive (label, hint, role, state, action buttons)
- **IssueListItem**: Comprehensive (label, hint, role, state, action buttons)

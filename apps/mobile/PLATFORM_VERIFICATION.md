# Platform Verification Guide

## Overview
This document provides instructions for verifying the AutoClaude Mobile Companion App on iOS and Android simulators/emulators.

**Subtask 7.5 Status:** Ready for manual testing
**Last Updated:** 2025-12-26

## Pre-Verification Checklist

- [x] TypeScript compilation passes (`npx tsc --noEmit`)
- [x] All 281 tests pass (`npm test`)
- [x] Expo doctor passes 17/17 checks (`npx expo-doctor`)
- [x] App exports for both platforms (`npx expo export --platform all`)

## Device Verification Matrix

| Platform | Device | Resolution | Checks |
|----------|--------|------------|--------|
| iOS | iPhone 14 Simulator | 390x844 | Phone layout |
| iOS | iPad Pro Simulator | 1024x1366 | Tablet layout |
| Android | Pixel 5 Emulator | 393x851 | Phone layout |
| Android | Galaxy Tab Emulator | 800x1280 | Tablet layout |

## Testing Instructions

### Starting the App

```bash
# Start Metro bundler
npx expo start -c

# Press 'i' for iOS simulator
# Press 'a' for Android emulator
```

### Verification Checklist

#### 1. Navigation (All Devices)
- [ ] Bottom tabs render correctly
- [ ] All 5 tabs are navigable (Home, Projects, Chat, GitHub, Settings)
- [ ] Active tab is visually highlighted with pale yellow (#E6E7A3)
- [ ] Tab icons are visible and properly sized
- [ ] Tab bar has correct height (iOS: 88px, Android: 64px)

#### 2. Dark Theme (All Devices)
- [ ] Background color is dark (#0B0B0F)
- [ ] Surface colors use proper elevation (#1a1a2e, #16162a)
- [ ] Text is readable (primary: #FFFFFF, secondary: #B0B0B0)
- [ ] Accent colors are pale yellow (#E6E7A3)
- [ ] Status badges have correct colors (success, warning, error)

#### 3. Home/Dashboard Screen
- [ ] Kanban board renders with 5 columns
- [ ] Column headers show task counts
- [ ] Task cards display with proper styling
- [ ] FAB button is visible and functional
- [ ] Pull-to-refresh works
- [ ] Stats summary shows column counts

#### 4. Task Card Component
- [ ] Title truncates properly
- [ ] Status, priority badges render
- [ ] Complexity indicator shows correctly
- [ ] Press navigates to task detail
- [ ] Long press triggers quick actions

#### 5. Kanban Drag and Drop (Touch Devices)
- [ ] Long press initiates drag
- [ ] Card follows touch position
- [ ] Drop zone highlights on hover
- [ ] Drop updates task status
- [ ] Smooth animation on drop

#### 6. Chat Screen
- [ ] Session drawer opens/closes
- [ ] Messages display correctly
- [ ] User messages right-aligned
- [ ] Assistant messages left-aligned with avatar
- [ ] Input field is functional
- [ ] Send button works
- [ ] Streaming animation displays

#### 7. GitHub Screen
- [ ] Issues/PRs toggle works
- [ ] Filters apply correctly
- [ ] List items render with badges
- [ ] Navigation to detail works
- [ ] Investigate/Auto-fix buttons work

#### 8. Settings Screen
- [ ] Connection section displays
- [ ] Theme toggle works
- [ ] Notification toggles work
- [ ] All settings persist after restart

#### 9. Terminal Viewer
- [ ] Session list renders
- [ ] Terminal output uses monospace font (iOS: Menlo, Android: monospace)
- [ ] Auto-scroll works
- [ ] Line numbers display correctly

#### 10. Onboarding
- [ ] Multi-step wizard works
- [ ] Progress indicator updates
- [ ] Skip button navigates to main app
- [ ] Camera permission request works

### Platform-Specific Checks

#### iOS Only
- [ ] Safe area insets respected
- [ ] Keyboard avoiding behavior works
- [ ] Tab bar extends under home indicator
- [ ] Menlo font renders in terminal

#### Android Only
- [ ] Navigation bar padding correct
- [ ] Material Design gestures work
- [ ] Monospace font renders in terminal
- [ ] Back button navigates correctly

### Tablet-Specific Checks
- [ ] Bottom tabs positioned correctly
- [ ] Content fills screen appropriately
- [ ] Lists don't appear too narrow
- [ ] Modal dialogs centered
- [ ] Kanban columns properly sized

### Performance Checks
- [ ] Smooth scrolling on large lists
- [ ] No visible frame drops
- [ ] Pull-to-refresh is responsive
- [ ] Animations run at 60fps

## Known Platform Handling

The app includes proper platform-specific implementations:

1. **Tab Bar Height**: iOS 88px (with home indicator), Android 64px
2. **Keyboard Handling**: iOS uses `padding` behavior, Android uses `height`
3. **Monospace Fonts**: iOS uses Menlo, Android uses system monospace
4. **Safe Areas**: Uses react-native-safe-area-context for proper insets
5. **Gestures**: Uses react-native-gesture-handler for consistent gesture handling

## Accessibility Verification

- [ ] VoiceOver can navigate all interactive elements (iOS)
- [ ] TalkBack can navigate all interactive elements (Android)
- [ ] All buttons have accessibility labels
- [ ] All inputs have accessibility labels
- [ ] Focus order is logical

## Error Handling

- [ ] Error boundary catches render errors
- [ ] Offline indicator shows when disconnected
- [ ] Empty states display helpful messages
- [ ] Network errors handled gracefully

## Verification Results

| Device | Date | Tester | Result | Notes |
|--------|------|--------|--------|-------|
| iPhone 14 | | | | |
| iPad Pro | | | | |
| Pixel 5 | | | | |
| Galaxy Tab | | | | |

## Export Verification

Both platforms export successfully:
- iOS bundle: 5.57 MB
- Android bundle: 5.57 MB
- 33 assets exported
- Metadata generated

# AutoClaude Mobile Companion App

A cross-platform React Native mobile application built with Expo for remote control and monitoring of AutoClaude desktop application. Monitor tasks, manage projects, interact with AI, and stay updated from your iOS or Android device.

## Features

- **Kanban Task Board** - Drag-and-drop task management with 5 columns (Backlog, In Progress, AI Review, Human Review, Done)
- **Multi-Session AI Chat** - Interactive chat with streaming responses and tool call visualization
- **GitHub Integration** - View issues and PRs with investigate and auto-fix actions
- **Project Management** - Browse projects with roadmap, ideation, and context viewers
- **Terminal Viewer** - Read-only terminal output with real-time streaming
- **Push Notifications** - Task completion, errors, and review notifications
- **Dark Theme** - Consistent AutoClaude dark theme across all screens

## Tech Stack

| Technology | Version | Purpose |
|------------|---------|---------|
| Expo | 54.0.x | Development framework |
| React Native | 0.81.x | Mobile framework |
| TypeScript | 5.9.x | Type safety |
| Expo Router | 6.x | File-based navigation |
| Zustand | 5.0.x | State management |
| TanStack Query | 5.90.x | Data fetching & caching |
| React Native Paper | 5.14.x | Material Design UI |
| React Native Reanimated | 4.1.x | Animations |

## Prerequisites

- **Node.js** 18.x or higher
- **npm** 9.x or higher (or yarn/pnpm)
- **Expo CLI** (installed automatically via npx)
- **iOS Simulator** (macOS only, requires Xcode)
- **Android Emulator** (requires Android Studio)

## Getting Started

### 1. Install Dependencies

```bash
cd apps/mobile
npm install
```

### 2. Start Development Server

```bash
# Start Expo with Metro bundler
npx expo start

# Or with cleared cache (recommended after config changes)
npx expo start -c
```

### 3. Run on Device/Simulator

From the Expo DevTools terminal:
- Press `i` - Open iOS Simulator
- Press `a` - Open Android Emulator
- Scan QR code - Run on physical device via Expo Go

### 4. Run Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm test -- --watch

# Run with coverage
npm test -- --coverage
```

### 5. TypeScript Check

```bash
npm run typecheck
```

## Project Structure

```
apps/mobile/
├── app/                    # Expo Router pages (file-based routing)
│   ├── (tabs)/            # Bottom tab navigation screens
│   │   ├── _layout.tsx    # Tab navigator configuration
│   │   ├── index.tsx      # Home/Dashboard with Kanban
│   │   ├── projects.tsx   # Projects list
│   │   ├── chat.tsx       # AI Chat interface
│   │   ├── github.tsx     # GitHub issues/PRs
│   │   └── settings.tsx   # App settings
│   ├── task/              # Task-related screens
│   │   ├── [id].tsx       # Task detail view
│   │   └── create.tsx     # Task creation wizard
│   ├── project/[id].tsx   # Project detail view
│   ├── github/            # GitHub detail screens
│   ├── terminal/          # Terminal viewer screens
│   ├── roadmap.tsx        # Roadmap viewer
│   ├── ideation.tsx       # Ideation browser
│   ├── context.tsx        # Context browser
│   ├── onboarding.tsx     # First-launch wizard
│   ├── _layout.tsx        # Root layout with providers
│   └── index.tsx          # Entry redirect
│
├── components/            # Reusable UI components
│   ├── KanbanBoard.tsx    # Drag-and-drop Kanban
│   ├── TaskCard.tsx       # Task card with badges
│   ├── ChatMessage.tsx    # Chat message with streaming
│   ├── TerminalOutput.tsx # Terminal viewer
│   ├── ErrorBoundary.tsx  # Error handling
│   ├── OfflineIndicator.tsx # Network status
│   └── ...                # More components
│
├── stores/                # Zustand state stores
│   ├── taskStore.ts       # Task management
│   ├── projectStore.ts    # Project management
│   ├── chatStore.ts       # Chat sessions
│   ├── settingsStore.ts   # App settings
│   ├── githubStore.ts     # GitHub integration
│   └── terminalStore.ts   # Terminal sessions
│
├── api/                   # API layer
│   ├── client.ts          # TanStack Query client
│   └── websocket.ts       # WebSocket client
│
├── types/                 # TypeScript type definitions
├── theme/                 # Theme configuration
├── utils/                 # Utility functions
└── assets/                # Images, fonts, icons
```

## Navigation

The app uses Expo Router v6 with file-based routing:

| Route | Screen | Description |
|-------|--------|-------------|
| `/` | Home/Dashboard | Kanban board with task overview |
| `/projects` | Projects | Project list with filters |
| `/chat` | AI Chat | Multi-session chat interface |
| `/github` | GitHub | Issues and PRs |
| `/settings` | Settings | App configuration |
| `/task/[id]` | Task Detail | Task overview, logs, files, plan |
| `/task/create` | Create Task | Multi-step creation wizard |
| `/project/[id]` | Project Detail | Project overview with tasks |
| `/github/issue/[id]` | Issue Detail | GitHub issue view |
| `/github/pr/[id]` | PR Detail | Pull request view |
| `/terminal` | Terminal List | Active terminal sessions |
| `/terminal/[id]` | Terminal Detail | Terminal output viewer |
| `/roadmap` | Roadmap | Feature roadmap viewer |
| `/ideation` | Ideation | Ideas browser |
| `/context` | Context | File tree and memory |
| `/onboarding` | Onboarding | First-launch setup |

## State Management

The app uses Zustand v5 with persist middleware for state management:

```typescript
// Example: Using a store
import { useTaskStore } from '../stores/taskStore';

function MyComponent() {
  const tasks = useTaskStore((state) => state.tasks);
  const addTask = useTaskStore((state) => state.addTask);

  // Use tasks and actions...
}
```

### Store Persistence

- Most stores persist to AsyncStorage
- API keys stored securely in expo-secure-store
- Settings sync across app restarts

## Theming

The app uses a consistent dark theme defined in `theme/index.ts`:

```typescript
import { colors, spacing, borderRadius } from '../theme';

// Primary background: #0B0B0F
// Surface: #1a1a2e
// Accent: #E6E7A3 (pale yellow)
```

## Testing

### Unit Tests

Located in `stores/__tests__/`:
- Task store CRUD operations
- Project management
- Chat session management
- Settings persistence

### Integration Tests

Located in `__tests__/`:
- Navigation flow testing
- Store integration with TanStack Query
- Cross-store synchronization

### Running Tests

```bash
# All tests
npm test

# Specific test file
npm test -- taskStore.test.ts

# With coverage
npm test -- --coverage
```

## Development Workflow

### Adding a New Screen

1. Create file in `app/` directory (follows file-based routing)
2. Export default component
3. Add to `_layout.tsx` if special options needed

### Adding a New Store

1. Create in `stores/` following existing patterns
2. Use Zustand `create()` with TypeScript generics
3. Add persist middleware for data that should survive restarts
4. Export hook and selector hooks

### Adding a New Component

1. Create in `components/`
2. Add accessibility labels (`accessibilityLabel`, `accessibilityRole`, etc.)
3. Use theme colors from `theme/index.ts`
4. Export from `components/index.ts`

## Platform-Specific Notes

### iOS
- Tab bar height: 88px (includes home indicator)
- Terminal font: Menlo
- Keyboard behavior: padding

### Android
- Tab bar height: 64px
- Terminal font: system monospace
- Keyboard behavior: height

## Mock Data

Currently uses mock data for all features. Mock data is defined in:
- Store initial states
- `utils/mockWebSocket.ts` for simulated real-time updates

## Troubleshooting

### Metro Cache Issues
```bash
npx expo start -c
```

### Dependency Issues
```bash
npm install --legacy-peer-deps
```

### Type Errors
```bash
npm run typecheck
```

### Expo Doctor
```bash
npx expo-doctor
```

## Configuration Files

| File | Purpose |
|------|---------|
| `app.json` | Expo app configuration |
| `tsconfig.json` | TypeScript configuration |
| `babel.config.js` | Babel with React Native Paper plugin |
| `metro.config.js` | Metro bundler with mjs support |
| `package.json` | Dependencies and scripts |

## Environment Variables

Currently using mock data. For Phase 6 API integration:
- `AUTOCLAUDE_API_URL` - Backend API URL
- `AUTOCLAUDE_WS_URL` - WebSocket URL

API keys are stored in expo-secure-store, not environment variables.

## Documentation

Additional documentation:
- `ACCESSIBILITY_TESTING.md` - VoiceOver/TalkBack testing guide
- `PLATFORM_VERIFICATION.md` - Device testing checklist

## License

Part of the AutoClaude project.

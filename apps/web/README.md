# Auto Claude Web UI

A modern web-based browser application for the Auto Claude autonomous coding framework. This is a lightweight alternative to the Electron desktop app that runs directly in your browser.

## Overview

The web version provides the same powerful features as the desktop app but runs entirely in your browser:
- Real-time task management with Kanban board
- Multiple terminal emulation with xterm.js
- WebSocket-based communication with Python backend
- All the familiar Auto Claude features without installing a desktop app

**Key Differences from Desktop App:**
- Runs in any modern browser (no installation required)
- Communicates via WebSocket instead of Electron IPC
- Lighter weight with faster startup times
- Same UI components and design system

## Prerequisites

### Node.js v24.12.0 LTS (Required)

This project requires **Node.js v24.12.0 LTS** (Latest LTS version).

**Download:** https://nodejs.org/en/download/

**Or install via command line:**

**Windows:**
```bash
winget install OpenJS.NodeJS.LTS
```

**macOS:**
```bash
brew install node@24
```

**Linux (Ubuntu/Debian):**
```bash
curl -fsSL https://deb.nodesource.com/setup_24.x | sudo -E bash -
sudo apt install -y nodejs
```

**Verify installation:**
```bash
node --version  # Should output: v24.12.0 or higher
npm --version   # Should output: 11.x.x or higher
```

### Backend WebSocket Server (Required)

The web UI requires the Python backend WebSocket server to be running:

```bash
cd apps/backend
python web_server.py
```

See [Backend Setup](#backend-setup) for details.

## Quick Start

```bash
# Navigate to web directory
cd apps/web

# Install dependencies
npm install

# Copy environment configuration
cp .env.example .env

# Start development server
npm run dev
```

The app will be available at `http://localhost:5173`

## Backend Setup

The web UI requires the Python backend WebSocket server:

### 1. Install Backend Dependencies

```bash
cd apps/backend
python -m pip install -r requirements.txt
```

This includes the `websockets>=11.0` library for WebSocket support.

### 2. Configure Backend (Optional)

Create or update `apps/backend/.env`:

```bash
WEB_SERVER_PORT=8765
WEB_SERVER_HOST=0.0.0.0
CORS_ORIGINS=http://localhost:5173
```

### 3. Start WebSocket Server

```bash
cd apps/backend
python web_server.py
```

The WebSocket server will start on `ws://localhost:8765` by default.

## Architecture

### Tech Stack

- **Framework:** React 19 with TypeScript
- **Build Tool:** Vite 7
- **Styling:** Tailwind CSS v4 (PostCSS-based with @theme directive)
- **State Management:** Zustand v5
- **UI Components:** Radix UI primitives with shadcn/ui patterns
- **Terminal:** @xterm/xterm v6.0.0 with FitAddon
- **Communication:** WebSocket client (browser native)

### Communication Flow

```
Browser (React)
    ↓ WebSocket
WebSocket Server (Python)
    ↓ Message Routing
Backend Handlers (Python)
    ↓ PTY/Task Management
System Operations
```

### Project Structure

```
apps/web/
├── src/
│   ├── components/          # React components
│   │   ├── ui/              # Reusable UI primitives (shadcn/ui)
│   │   ├── ConnectionStatus.tsx
│   │   ├── TaskList.tsx
│   │   ├── TaskEditDialog.tsx
│   │   ├── Terminal.tsx
│   │   └── ...
│   │
│   ├── stores/              # Zustand state stores
│   │   ├── task-store.ts    # Task management state
│   │   ├── terminal-store.ts # Terminal sessions state
│   │   └── ...
│   │
│   ├── lib/                 # Utilities and abstractions
│   │   ├── websocket-client.ts    # WebSocket connection manager
│   │   ├── ipc-abstraction.ts     # IPC-like API over WebSocket
│   │   └── utils.ts               # Shared utilities
│   │
│   ├── styles/              # Global styles
│   │   └── globals.css      # Tailwind v4 @theme configuration
│   │
│   ├── App.tsx              # Main app component
│   └── main.tsx             # Entry point
│
├── public/                  # Static assets
├── dist/                    # Build output (generated)
├── .env                     # Environment variables (local)
├── .env.example             # Environment template
├── index.html               # HTML entry point
├── package.json             # Dependencies and scripts
├── postcss.config.cjs       # PostCSS + Tailwind v4 config
├── tsconfig.json            # TypeScript configuration
└── vite.config.ts           # Vite build configuration
```

## Configuration

### Environment Variables

Create `.env` in `apps/web/`:

```bash
# WebSocket server URL (required)
VITE_WS_URL=ws://localhost:8765

# Backend API URL (optional, for future REST endpoints)
VITE_API_URL=http://localhost:8000
```

**Notes:**
- All environment variables must be prefixed with `VITE_` to be exposed to the client
- Variables are embedded at build time and cannot be changed after building
- For production, use `wss://` for secure WebSocket connections

### Development vs Production

**Development:**
```bash
VITE_WS_URL=ws://localhost:8765
VITE_API_URL=http://localhost:8000
```

**Production:**
```bash
VITE_WS_URL=wss://your-domain.com/ws
VITE_API_URL=https://your-domain.com/api
```

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server with hot reload (default: port 5173) |
| `npm run build` | Build for production (output: `dist/`) |
| `npm run preview` | Preview production build locally |
| `npm test` | Run unit tests with Vitest |
| `npm run test:watch` | Run tests in watch mode |
| `npm run test:coverage` | Run tests with coverage report |
| `npm run lint` | Check for lint errors with Biome |
| `npm run lint:fix` | Auto-fix lint errors |
| `npm run format` | Format code with Biome |
| `npm run typecheck` | Type check TypeScript without building |

## Development

### Running in Development Mode

**Terminal 1: Backend WebSocket Server**
```bash
cd apps/backend
python web_server.py
```

**Terminal 2: Web UI**
```bash
cd apps/web
npm run dev
```

Open `http://localhost:5173` in your browser.

### Adding New Features

The web app follows the same component patterns as the Electron desktop app:

1. **Components** - Use shadcn/ui patterns with Tailwind CSS
2. **State** - Zustand v5 stores for state management
3. **Communication** - IPC abstraction layer over WebSocket
4. **Styling** - Tailwind v4 with @theme directive in `globals.css`

### WebSocket Communication

The app uses a WebSocket client with an IPC-like abstraction layer:

```typescript
import { ipc } from '@/lib/ipc-abstraction'

// Send message to backend
ipc.send('terminal:start', { sessionId: 'terminal-1' })

// Listen for responses
ipc.on('terminal:data', (data) => {
  console.log('Terminal output:', data)
})
```

**Available Channels:**
- `terminal:start` - Start new terminal session
- `terminal:input` - Send input to terminal
- `terminal:resize` - Resize terminal dimensions
- `terminal:data` - Receive terminal output
- `task:*` - Task management operations
- `ping` / `echo` - Connection health checks

## Terminal Emulation

The web app uses xterm.js v6.0.0 for terminal emulation:

```typescript
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import '@xterm/xterm/css/xterm.css'

const terminal = new Terminal({
  cursorBlink: true,
  fontSize: 14,
  fontFamily: 'JetBrains Mono, monospace'
})

const fitAddon = new FitAddon()
terminal.loadAddon(fitAddon)

// Must attach to DOM element
terminal.open(containerElement)
fitAddon.fit()

// Connect to backend PTY via WebSocket
ipc.send('terminal:start', { sessionId })
ipc.on('terminal:data', (data) => terminal.write(data))
terminal.onData((data) => ipc.send('terminal:input', { sessionId, data }))
```

## Building for Production

```bash
# Build the app
npm run build

# Preview the build
npm run preview
```

The build output will be in `dist/`. Deploy this directory to any static hosting service:
- Vercel
- Netlify
- AWS S3 + CloudFront
- nginx
- Any static file server

**Important:** Ensure your backend WebSocket server is accessible from your production domain and update `VITE_WS_URL` accordingly.

## Deployment

### Static Hosting

The web app is a static SPA that can be deployed to any static hosting:

1. Build the app: `npm run build`
2. Upload `dist/` to your hosting provider
3. Configure backend WebSocket URL in environment variables
4. Ensure WebSocket server is running and accessible

### Backend Requirements

Your production environment needs:
- Python backend with WebSocket server running
- WebSocket server accessible via `wss://` (secure WebSocket)
- CORS configured to allow your web app domain

### Example nginx Configuration

```nginx
server {
    listen 80;
    server_name your-domain.com;

    # Serve static web app
    location / {
        root /path/to/dist;
        try_files $uri $uri/ /index.html;
    }

    # Proxy WebSocket connections
    location /ws {
        proxy_pass http://localhost:8765;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "Upgrade";
        proxy_set_header Host $host;
    }
}
```

## Troubleshooting

### Connection Issues

**Problem:** "WebSocket disconnected" or connection errors

**Solutions:**
1. Verify backend WebSocket server is running:
   ```bash
   cd apps/backend && python web_server.py
   ```
2. Check `VITE_WS_URL` in `.env` matches the server address
3. Ensure no firewall is blocking port 8765
4. Check browser console for detailed error messages

### Terminal Not Working

**Problem:** Terminal doesn't display or accept input

**Solutions:**
1. Check WebSocket connection status in UI
2. Verify PTY sessions are created (check backend logs)
3. Ensure `@xterm/xterm` CSS is loaded:
   ```typescript
   import '@xterm/xterm/css/xterm.css'
   ```
4. Check that `terminal.open(element)` was called

### Build Errors

**Problem:** TypeScript errors during build

**Solutions:**
1. Run type check: `npm run typecheck`
2. Update dependencies: `npm install`
3. Clear cache: `rm -rf node_modules dist && npm install`

### Hot Reload Not Working

**Problem:** Changes not reflected in browser

**Solutions:**
1. Restart dev server: `Ctrl+C`, then `npm run dev`
2. Clear browser cache and hard reload
3. Check for TypeScript errors in terminal

## Browser Compatibility

Tested and supported on:
- Chrome/Edge 90+
- Firefox 88+
- Safari 14+

**Requirements:**
- WebSocket support (all modern browsers)
- ES2020+ JavaScript features
- CSS Grid and Flexbox

## Key Differences from Desktop App

| Feature | Desktop App | Web App |
|---------|-------------|---------|
| **Platform** | Electron (native) | Browser |
| **Installation** | Required | None |
| **Communication** | IPC | WebSocket |
| **File System** | Direct access | Via backend |
| **Terminal** | node-pty | xterm.js + backend PTY |
| **Updates** | Auto-updater | Deploy new build |
| **Startup** | ~2-3 seconds | Instant |
| **Memory** | ~150-200 MB | ~50-100 MB |

## Performance Tips

1. **Limit Terminal History** - Configure xterm.js scrollback:
   ```typescript
   new Terminal({ scrollback: 1000 })
   ```

2. **Virtualize Long Lists** - Use `@tanstack/react-virtual` for task lists

3. **Lazy Load Components** - Use React.lazy() for code splitting

4. **Optimize WebSocket Messages** - Batch updates when possible

## Security

### WebSocket Security

- Use `wss://` in production (encrypted WebSocket)
- Configure CORS on backend to allow only trusted domains
- Validate all messages on both client and server
- Never expose sensitive data in WebSocket messages

### Content Security Policy

Add CSP headers to your hosting configuration:

```
Content-Security-Policy: default-src 'self'; connect-src 'self' wss://your-domain.com; style-src 'self' 'unsafe-inline';
```

## Development Guidelines

### Code Style

- Use TypeScript strict mode
- Follow existing component patterns
- Use Tailwind utilities instead of custom CSS
- Keep components small and focused
- Extract reusable logic to hooks

### Testing

```bash
# Run all tests
npm test

# Watch mode
npm run test:watch

# Coverage report
npm run test:coverage
```

### Naming Conventions

| Type | Convention | Example |
|------|------------|---------|
| Components | PascalCase | `TaskList.tsx` |
| Hooks | camelCase with `use` | `useTaskStore.ts` |
| Stores | kebab-case with `-store` | `task-store.ts` |
| Types | PascalCase | `Task`, `TaskStatus` |

## Contributing

Follow the same guidelines as the main Auto Claude project. See [CONTRIBUTING.md](../../CONTRIBUTING.md) for details.

## License

AGPL-3.0 - Same as Auto Claude desktop app

---

## Additional Resources

- [Main Project README](../../README.md)
- [Backend Documentation](../backend/README.md)
- [Frontend Documentation](../frontend/README.md)
- [WebSocket Protocol Spec](./.auto-claude/specs/001-pending/spec.md)
- [Discord Community](https://discord.gg/KCXaPBr4Dj)

---

**Need Help?** Join our [Discord community](https://discord.gg/KCXaPBr4Dj) or [open an issue](https://github.com/AndyMik90/Auto-Claude/issues).

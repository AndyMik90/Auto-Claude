# Auto Claude Extended Electron MCP Server

Extended Chrome DevTools Protocol (CDP) MCP server for AI agents.

## Features

This MCP server provides enhanced CDP tools for Electron automation:

### Base Tools (Always Available)
- `mcp__electron__get_electron_window_info` - Get window information
- `mcp__electron__take_screenshot` - Capture screenshots
- `mcp__electron__send_command_to_electron` - Send commands (click, fill, eval)
- `mcp__electron__read_electron_logs` - Read console logs

### Network Domain Tools
- `mcp__electron__get_network_logs` - HTTP request/response history
- `mcp__electron__get_request_details` - Full request headers/body
- `mcp__electron__get_performance_timing` - Resource timing metrics

### Storage Tools
- `mcp__electron__get_storage` - Read localStorage/sessionStorage
- `mcp__electron__set_storage` - Write storage items
- `mcp__electron__clear_storage` - Clear all storage
- `mcp__electron__get_cookies` - Cookie inspection
- `mcp__electron__get_app_state` - Full application state snapshot

### Performance Tools
- `mcp__electron__get_metrics` - Web vitals (FCP, LCP, TTI, FPS)
- `mcp__electron__get_memory_usage` - Heap size and used memory
- `mcp__electron__start_profiling` - Start CPU profiling
- `mcp__electron__stop_profiling` - Stop CPU profiling

### Emulation Tools
- `mcp__electron__set_device` - Device emulation (mobile, tablet)
- `mcp__electron__set_network_throttle` - Network throttling (offline, 3G, 4G)
- `mcp__electron__set_geolocation` - GPS simulation
- `mcp__electron__set_theme` - Dark/light mode toggle

### Enhanced DOM Tools
- `mcp__electron__drag_and_drop` - Drag element to target
- `mcp__electron__right_click` - Context menu interaction
- `mcp__electron__hover` - Hover over element
- `mcp__electron__scroll_to_element` - Smooth scroll
- `mcp__electron__get_element_state` - Element state (disabled, hidden, visible)

### Console Tools
- `mcp__electron__get_logs_filtered` - Filter logs by level/regex
- `mcp__electron__track_exceptions` - Exception tracking
- `mcp__electron__get_console_history` - Full console history

## Installation

```bash
npm install
npm run build
```

## Usage

The server is automatically started by the Auto Claude backend when `ELECTRON_MCP_ENABLED=true`.

### Starting the Electron App with CDP

Your Electron app must be started with remote debugging enabled:

```bash
# Development mode
npm run dev:mcp

# Production mode
npm run start:mcp
```

Or manually:

```bash
your-electron-app --remote-debugging-port=9222
```

## Configuration

Environment variables:

- `ELECTRON_MCP_ENABLED` - Enable Electron MCP integration (default: false)
- `ELECTRON_DEBUG_PORT` - Chrome DevTools port (default: 9222)
- `CDP_ENABLED_FOR_AGENTS` - Agents with CDP access (default: qa_reviewer,qa_fixer)
- `CDP_TOOL_CATEGORIES` - Enabled tool categories (default: all)
- `CDP_LOG_LEVEL` - Logging level (none, basic, verbose, debug)

## Architecture

The server uses Chrome Remote Interface to connect to Electron apps via CDP:

```
┌─────────────────┐     CDP      ┌─────────────────┐
│  AI Agent       │◄────────────►│  Electron App   │
│  (via MCP SDK)  │    port 9222  │  (with CDP)     │
└─────────────────┘              └─────────────────┘
         │                                 │
         │                                 │
         └────────────────┬────────────────┘
                          │
                  ┌───────▼────────┐
                  │ electron-mcp-  │
                  │ server (this)  │
                  └────────────────┘
```

## Development

```bash
# Watch mode for development
npm run watch

# Build
npm run build
```

## License

MIT

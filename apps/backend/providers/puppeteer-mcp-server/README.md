# Auto Claude Extended Puppeteer MCP Server

Extended Puppeteer-based MCP server for browser automation with AI agents.

## Features

This MCP server provides enhanced browser automation tools using Puppeteer with CDP (Chrome DevTools Protocol):

### Base Tools (Always Available)
- `mcp__puppeteer__puppeteer_connect_active_tab` - Connect to or launch browser
- `mcp__puppeteer__puppeteer_navigate` - Navigate to URL
- `mcp__puppeteer__puppeteer_screenshot` - Capture screenshots
- `mcp__puppeteer__puppeteer_click` - Click elements
- `mcp__puppeteer__puppeteer_fill` - Fill input fields
- `mcp__puppeteer__puppeteer_select` - Select dropdown options
- `mcp__puppeteer__puppeteer_hover` - Hover over elements
- `mcp__puppeteer__puppeteer_evaluate` - Execute JavaScript

### Network Domain Tools
- `mcp__puppeteer__get_network_logs` - HTTP request/response history
- `mcp__puppeteer__get_request_details` - Full request headers/body

### Storage Tools
- `mcp__puppeteer__get_storage` - Read localStorage/sessionStorage
- `mcp__puppeteer__set_storage` - Write storage items
- `mcp__puppeteer__get_cookies` - Cookie inspection
- `mcp__puppeteer__get_app_state` - Full application state

### Performance Tools
- `mcp__puppeteer__get_metrics` - Web vitals and timing metrics
- `mcp__puppeteer__get_memory_usage` - Heap memory usage

### Emulation Tools
- `mcp__puppeteer__set_device` - Device emulation (iPhone, iPad, Pixel)
- `mcp__puppeteer__set_network_throttle` - Network throttling (offline, 3G, 4G)
- `mcp__puppeteer__set_geolocation` - GPS simulation

### Enhanced DOM Tools
- `mcp__puppeteer__drag_and_drop` - Drag element to target
- `mcp__puppeteer__right_click` - Right-click/context menu
- `mcp__puppeteer__scroll_to_element` - Smooth scroll to element
- `mcp__puppeteer__get_element_state` - Element state (visible, enabled, focused)

### Console Tools
- `mcp__puppeteer__get_console_logs` - Console logs with filtering
- `mcp__puppeteer__track_exceptions` - Exception tracking

## Installation

```bash
cd apps/backend/providers/puppeteer-mcp-server
npm install
npm run build
```

## Usage

The server is automatically started by the Auto Claude backend when:
1. The project is detected as a web frontend (React, Vue, Next.js, etc.)
2. QA agents request browser automation tools
3. The project is NOT an Electron app

### Browser Detection

Auto Claude automatically detects web frontends by analyzing:
- Framework names in service configurations
- Dependencies in package.json
- Meta-frameworks like Next.js and Nuxt

### Environment Variables

```bash
# Puppeteer configuration
PUPPETEER_HEADLESS=false  # Show browser window (default: true)
```

## Comparison with Electron MCP Server

| Feature | Puppeteer MCP | Electron MCP |
|---------|---------------|--------------|
| Use Case | Web frontends (React, Vue, etc.) | Electron desktop apps |
| Connection | Launches Chrome/Chromium | Connects via CDP to running app |
| Network Tools | ✅ | ✅ |
| Storage Tools | ✅ | ✅ |
| Performance | ✅ | ✅ |
| Emulation | ✅ | ✅ |
| DOM Tools | ✅ | ✅ |
| Console Tools | ✅ | ✅ |

## Architecture

```
┌────────────────────────────────────────────────────────────────────┐
│                        AI Agent (SDK Client)                     │
└─────────────────────────────────────┬──────────────────────────────┘
                                  │
                        MCP Protocol (stdio)
                                  │
┌─────────────────────────────────────▼──────────────────────────────┐
│                 @auto-claude/puppeteer-mcp-server                │
│  ┌──────────────────────────────────────────────────────────────┐ │
│  │                      Puppeteer Browser                       │ │
│  │  (Chrome, Chromium, or Edge)                                 │ │
│  └──────────────────────────────────────────────────────────────┘ │
└────────────────────────────────────────────────────────────────────┘
                                  │
                            CDP (internal)
                                  │
┌─────────────────────────────────────▼──────────────────────────────┐
│                       Web Application                           │
│                  (React, Vue, Next.js, etc.)                    │
└────────────────────────────────────────────────────────────────────┘
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

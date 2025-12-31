# Chrome DevTools MCP Setup Guide

This guide explains how to set up Chrome DevTools Protocol (CDP) integration with Model Context Protocol (MCP) for Electron applications.

## Overview

The Electron MCP server provides enhanced CDP tools for AI agents to interact with Electron applications. It enables:
- UI automation and testing
- Screenshot capture
- Network monitoring
- Storage inspection
- Performance metrics
- Device emulation
- And much more

## Prerequisites

1. **Node.js 18+** installed
2. **Electron application** with remote debugging support
3. **Auto Claude** project with MCP configuration

## Setup Steps

### 1. Environment Configuration

The `.env` file in `/apps/backend/.env` should contain:

```bash
# Enable Electron MCP integration
ELECTRON_MCP_ENABLED=true

# Chrome DevTools debugging port (default: 9222)
ELECTRON_DEBUG_PORT=9222

# CDP configuration for agent access
CDP_ENABLED_FOR_AGENTS=qa_reviewer,qa_fixer,coder
CDP_TOOL_CATEGORIES=network,storage,performance,emulation,console,dom
CDP_LOG_LEVEL=verbose
```

### 2. Build the Electron MCP Server

```bash
cd apps/backend/providers/electron-mcp-server
npm install
npm run build
```

The built server will be available at `dist/index.js`.

### 3. Start Electron App with Remote Debugging

To enable Chrome DevTools Protocol access, start your Electron app with the `--remote-debugging-port` flag:

```bash
# For development
npm run dev:mcp

# Or directly with Electron
npx electron . --remote-debugging-port=9222

# For production
electron . --remote-debugging-port=9222
```

### 4. Verify Connection

Once the Electron app is running with remote debugging enabled, the MCP server will automatically connect when invoked by AI agents.

You can test the connection manually:

```bash
# Test CDP connection
node test_mcp_connection.js
```

## Available MCP Tools

The Electron MCP server provides these categories of tools:

### Base Tools
- `mcp__electron__get_electron_window_info` - Get window information
- `mcp__electron__take_screenshot` - Capture screenshots
- `mcp__electron__send_command_to_electron` - Send commands (click, fill, eval)
- `mcp__electron__read_electron_logs` - Read console logs

### Network Tools
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

## Troubleshooting

### Common Issues

1. **Connection Refused (ECONNREFUSED)**
   - Ensure Electron app is running with `--remote-debugging-port=9222`
   - Check that port 9222 is not blocked by firewall

2. **No Targets Found**
   - Verify the Electron app has loaded a page/HTML content
   - Check that the app is not running in a headless mode

3. **Permission Issues**
   - Ensure the MCP server has proper permissions to connect to the Electron app
   - Check that both processes are running with compatible security contexts

### Testing Connection Manually

```javascript
import CDP from 'chrome-remote-interface';

// List available targets
const targets = await CDP.List({ port: 9222 });
console.log('Available targets:', targets);

// Connect to a specific target
const client = await CDP({ target: targets[0], port: 9222 });
await client.Page.enable();
await client.Runtime.enable();

// Execute JavaScript in the page
const result = await client.Runtime.evaluate({ 
  expression: 'document.title' 
});
console.log('Page title:', result.result.value);

await client.close();
```

## Integration with Auto Claude

The MCP server is automatically integrated with Auto Claude when:
- `ELECTRON_MCP_ENABLED=true` in environment
- Agent type is in `CDP_ENABLED_FOR_AGENTS` (default: qa_reviewer,qa_fixer)
- Project is detected as an Electron application

The Claude Agent SDK client will automatically include the Electron MCP server when creating agent sessions, providing AI agents with access to the CDP tools for automated testing and interaction.

## Security Considerations

- The MCP server only connects to local Electron apps on the same machine
- All connections are made over localhost (127.0.0.1)
- The server runs with the same permissions as the Electron app
- Network access is limited to the local debugging port
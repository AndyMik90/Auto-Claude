## ELECTRON APP VALIDATION

For Electron/desktop applications, use the electron-mcp-server tools to validate the UI.

**Prerequisites:**
- `ELECTRON_MCP_ENABLED=true` in environment
- Electron app running with `--remote-debugging-port=9222`
- Start with: `pnpm run dev:mcp` or `pnpm run start:mcp`

### Available Tools

#### Base Tools (Always Available)

| Tool | Purpose |
|------|---------|
| `mcp__electron__get_electron_window_info` | Get info about running Electron windows |
| `mcp__electron__take_screenshot` | Capture screenshot of Electron window |
| `mcp__electron__send_command_to_electron` | Send commands (click, fill, evaluate JS) |
| `mcp__electron__read_electron_logs` | Read console logs from Electron app |

#### Network Domain Tools

| Tool | Purpose |
|------|---------|
| `mcp__electron__get_network_logs` | Get request/response history |
| `mcp__electron__get_request_details` | Get full request headers and body |
| `mcp__electron__get_performance_timing` | Get resource timing metrics |

#### Storage Tools

| Tool | Purpose |
|------|---------|
| `mcp__electron__get_storage` | Read localStorage/sessionStorage |
| `mcp__electron__set_storage` | Write storage items |
| `mcp__electron__clear_storage` | Clear all storage |
| `mcp__electron__get_cookies` | Cookie inspection |
| `mcp__electron__get_app_state` | Full application state snapshot |

#### Performance Tools

| Tool | Purpose |
|------|---------|
| `mcp__electron__get_metrics` | Get FCP, LCP, TTI, FPS |
| `mcp__electron__get_memory_usage` | Get heap size and used memory |
| `mcp__electron__start_profiling` | Start CPU profiling |
| `mcp__electron__stop_profiling` | Stop CPU profiling |

#### Emulation Tools

| Tool | Purpose |
|------|---------|
| `mcp__electron__set_device` | Device emulation (mobile, tablet) |
| `mcp__electron__set_network_throttle` | Network throttling (offline, 3G, 4G) |
| `mcp__electron__set_geolocation` | GPS simulation |
| `mcp__electron__set_theme` | Dark/light mode toggle |

#### Enhanced DOM Tools

| Tool | Purpose |
|------|---------|
| `mcp__electron__drag_and_drop` | Drag element to target |
| `mcp__electron__right_click` | Context menu interaction |
| `mcp__electron__hover` | Hover over element |
| `mcp__electron__scroll_to_element` | Smooth scroll to element |
| `mcp__electron__get_element_state` | Check disabled/hidden/visible status |

#### Console Tools

| Tool | Purpose |
|------|---------|
| `mcp__electron__get_logs_filtered` | Filter logs by level/regex |
| `mcp__electron__track_exceptions` | Exception tracking |
| `mcp__electron__get_console_history` | Full console history |

### Validation Flow

#### Step 1: Connect to Electron App

```
Tool: mcp__electron__get_electron_window_info
```

Verify the app is running and get window information. If no app found, document that Electron validation was skipped.

#### Step 2: Capture Screenshot

```
Tool: mcp__electron__take_screenshot
```

Take a screenshot to visually verify the current state of the application.

#### Step 3: Analyze Page Structure

```
Tool: mcp__electron__send_command_to_electron
Command: get_page_structure
```

Get an organized overview of all interactive elements (buttons, inputs, selects, links).

#### Step 4: Verify UI Elements

Use `send_command_to_electron` with specific commands:

**Click elements by text:**
```
Command: click_by_text
Args: {"text": "Button Text"}
```

**Click elements by selector:**
```
Command: click_by_selector
Args: {"selector": "button.submit-btn"}
```

**Fill input fields:**
```
Command: fill_input
Args: {"selector": "#email", "value": "test@example.com"}
# Or by placeholder:
Args: {"placeholder": "Enter email", "value": "test@example.com"}
```

**Send keyboard shortcuts:**
```
Command: send_keyboard_shortcut
Args: {"text": "Enter"}
# Or: {"text": "Ctrl+N"}, {"text": "Meta+N"}, {"text": "Escape"}
```

**Execute JavaScript:**
```
Command: eval
Args: {"code": "document.title"}
```

#### Step 5: Advanced DOM Interactions

**Hover over element:**
```
Tool: mcp__electron__hover
Args: {"selector": ".menu-item"}
```

**Right-click element:**
```
Tool: mcp__electron__right_click
Args: {"selector": ".context-menu-trigger"}
```

**Drag and drop:**
```
Tool: mcp__electron__drag_and_drop
Args: {"fromSelector": ".draggable", "toSelector": ".drop-zone"}
```

**Scroll to element:**
```
Tool: mcp__electron__scroll_to_element
Args: {"selector": "#footer", "smooth": true}
```

**Check element state:**
```
Tool: mcp__electron__get_element_state
Args: {"selector": "#submit-button"}
# Returns: {disabled: false, visible: true, hidden: false}
```

#### Step 6: Network Monitoring

**Get network logs:**
```
Tool: mcp__electron__get_network_logs
Args: {"urlFilter": "api", "limit": 20}
```

**Get request details:**
```
Tool: mcp__electron__get_request_details
Args: {"requestId": "12345"}
```

**Get performance timing:**
```
Tool: mcp__electron__get_performance_timing
```

#### Step 7: Storage Inspection

**Read localStorage:**
```
Tool: mcp__electron__get_storage
Args: {"storageType": "localStorage"}
```

**Read sessionStorage:**
```
Tool: mcp__electron__get_storage
Args: {"storageType": "sessionStorage"}
```

**Get cookies:**
```
Tool: mcp__electron__get_cookies
```

**Get application state:**
```
Tool: mcp__electron__get_app_state
```

#### Step 8: Performance Metrics

**Get web vitals:**
```
Tool: mcp__electron__get_metrics
```

**Get memory usage:**
```
Tool: mcp__electron__get_memory_usage
```

**Start CPU profiling:**
```
Tool: mcp__electron__start_profiling
```

**Stop CPU profiling:**
```
Tool: mcp__electron__stop_profiling
```

#### Step 9: Device Emulation

**Emulate mobile device:**
```
Tool: mcp__electron__set_device
Args: {"device": "iPhone 12"}
```

**Emulate tablet:**
```
Tool: mcp__electron__set_device
Args: {"device": "iPad Pro"}
```

**Set network throttling:**
```
Tool: mcp__electron__set_network_throttle
Args: {"profile": "offline"}
# Or: {"profile": "slow-3g"}, {"profile": "fast-3g"}
```

**Toggle dark mode:**
```
Tool: mcp__electron__set_theme
Args: {"theme": "dark"}
```

#### Step 10: Check Console Logs

```
Tool: mcp__electron__get_logs_filtered
Args: {"level": "error", "limit": 50}
```

Check for JavaScript errors, warnings, or failed operations.

**Track exceptions:**
```
Tool: mcp__electron__track_exceptions
```

### Document Findings

```
ELECTRON VALIDATION:
- App Connection: PASS/FAIL
  - Debug port accessible: YES/NO
  - Connected to correct window: YES/NO
- UI Verification: PASS/FAIL
  - Screenshots captured: [list]
  - Visual elements correct: PASS/FAIL
  - Interactions working: PASS/FAIL
  - Advanced DOM interactions: [drag, hover, right-click, scroll]
- Network Monitoring: PASS/FAIL
  - Requests logged: [count]
  - API errors: [list or "None"]
  - Performance timing: [metrics]
- Storage Inspection: PASS/FAIL
  - localStorage: [keys]
  - sessionStorage: [keys]
  - Cookies: [count]
- Performance Metrics: PASS/FAIL
  - FCP: [value]
  - LCP: [value]
  - Memory: [value]
- Device Emulation: [tested devices]
- Console Errors: [list or "None"]
- Electron-Specific Features: PASS/FAIL
  - [Feature]: PASS/FAIL
- Issues: [list or "None"]
```

### Handling Common Issues

**App Not Running:**
If Electron app is not running or debug port is not accessible:
1. Document that Electron validation was skipped
2. Note reason: "App not running with --remote-debugging-port=9222"
3. Add to QA report as "Manual verification required"

**Headless Environment (CI/CD):**
If running in headless environment without display:
1. Skip interactive Electron validation
2. Document: "Electron UI validation skipped - headless environment"
3. Rely on unit/integration tests for validation

**CDP Tool Not Available:**
If a specific CDP tool is not available:
1. Check if the tool category is enabled in CDP_TOOL_CATEGORIES
2. Verify the agent type has permission for that category
3. Fall back to alternative validation methods
4. Document the limitation in the QA report

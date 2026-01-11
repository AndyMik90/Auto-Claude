# Electron MCP Server

End-to-end testing capabilities for Electron desktop applications.

## Overview

The Electron MCP server enables QA agents to interact with running Electron applications via Chrome DevTools Protocol. This allows automated testing of:
- UI interactions (clicks, typing, navigation)
- Visual verification (screenshots)
- Form validation
- Application state verification

## Requirements

### 1. Enable Remote Debugging
Start your Electron app with remote debugging:
```bash
# In package.json scripts
"dev": "electron . --remote-debugging-port=9222"

# Or directly
electron . --remote-debugging-port=9222
```

### 2. Configure Environment
In `apps/backend/.env`:
```bash
ELECTRON_MCP_ENABLED=true
ELECTRON_DEBUG_PORT=9222
```

### 3. Agent Type
Only QA agents (`qa_reviewer`, `qa_fixer`) have access to Electron MCP.

## Available Tools

### Window Management
| Tool | Description |
|------|-------------|
| `get_electron_window_info` | Get info about running windows |
| `take_screenshot` | Capture current screen state |

### UI Interaction
| Command | Description |
|---------|-------------|
| `click_by_text` | Click element by visible text |
| `click_by_selector` | Click element by CSS selector |
| `fill_input` | Fill form field by placeholder/selector |
| `select_option` | Select dropdown option |
| `send_keyboard_shortcut` | Send keyboard shortcuts |
| `navigate_to_hash` | Navigate to hash routes |

### Page Inspection
| Command | Description |
|---------|-------------|
| `get_page_structure` | Get organized overview of page |
| `debug_elements` | Get debugging info about buttons/forms |
| `verify_form_state` | Check form state and validation |
| `eval` | Execute custom JavaScript |

### Logging
| Tool | Description |
|------|-------------|
| `read_electron_logs` | Read console logs for debugging |

## Usage Examples

### Basic Test Flow
```
QA Agent Testing Login Form:

1. Take screenshot to see current state
   Tool: take_screenshot

2. Get page structure to find form elements
   Command: get_page_structure

3. Fill email field
   Command: fill_input
   Args: { placeholder: "Email", value: "test@example.com" }

4. Fill password field
   Command: fill_input
   Args: { placeholder: "Password", value: "testpass123" }

5. Click login button
   Command: click_by_text
   Args: { text: "Sign In" }

6. Take screenshot to verify result
   Tool: take_screenshot

7. Verify success state
   Command: get_page_structure
   → Check for "Welcome" or dashboard elements
```

### Navigation Testing
```
QA Agent Testing Navigation:

1. Navigate to settings
   Command: navigate_to_hash
   Args: { hash: "#settings" }

2. Verify settings page loaded
   Command: get_page_structure

3. Click specific menu item
   Command: click_by_text
   Args: { text: "Account Settings" }

4. Screenshot for verification
   Tool: take_screenshot
```

### Form Validation Testing
```
QA Agent Testing Validation:

1. Get form state before submission
   Command: verify_form_state

2. Submit empty form
   Command: click_by_text
   Args: { text: "Submit" }

3. Check for validation errors
   Command: get_page_structure
   → Look for error messages

4. Screenshot showing errors
   Tool: take_screenshot
```

## BD Automation Use Case

### Testing Auto Claude's Task Creation
```
Scenario: Verify task creation works correctly

1. Navigate to create screen
   Command: navigate_to_hash
   Args: { hash: "#create" }

2. Fill task title
   Command: fill_input
   Args: { placeholder: "Task title", value: "Program Mapping Engine" }

3. Fill description
   Command: fill_input
   Args: { placeholder: "Description", value: "Build job-to-program mapping..." }

4. Select complexity
   Command: select_option
   Args: { text: "Complex" }

5. Click create
   Command: click_by_text
   Args: { text: "Create Task" }

6. Verify task appears in list
   Command: get_page_structure
   → Check for "Program Mapping Engine" in task list

7. Screenshot final state
   Tool: take_screenshot
```

## Screenshot Management

### Size Limits
Screenshots are automatically compressed to stay under Claude SDK's 1MB JSON message buffer:
- Resolution: 1280x720
- Quality: 60% JPEG
- Format: Base64 encoded

### Best Practices
1. Take screenshots at key verification points
2. Don't screenshot after every action (wastes context)
3. Use `get_page_structure` for quick checks, screenshots for visual verification

## Error Handling

### Common Issues

| Error | Cause | Solution |
|-------|-------|----------|
| "Connection refused" | App not running with debug port | Start with `--remote-debugging-port=9222` |
| "Element not found" | Selector/text doesn't match | Use `get_page_structure` to find correct text |
| "Timeout" | Action took too long | Increase timeout, check app responsiveness |
| "Screenshot failed" | Window minimized/hidden | Ensure app is visible and focused |

### Debugging Tips
1. Use `read_electron_logs` to check for JavaScript errors
2. Use `debug_elements` to see what elements are available
3. Take screenshot before interaction to verify state

## Configuration Reference

### In `apps/backend/.env`
```bash
# Enable Electron MCP
ELECTRON_MCP_ENABLED=true

# Debug port (default 9222)
ELECTRON_DEBUG_PORT=9222
```

### In `apps/backend/core/client.py`
Electron MCP is automatically added for QA agents when:
- Project has Electron capability detected
- `ELECTRON_MCP_ENABLED=true`
- Agent type is `qa_reviewer` or `qa_fixer`

## Integration with QA Workflow

```
┌─────────────────────────────────────────────────────────┐
│                  QA Reviewer Agent                       │
│                                                          │
│  1. Read spec acceptance criteria                        │
│  2. Plan test scenarios                                  │
│  3. Execute tests via Electron MCP                       │
│  4. Document results with screenshots                    │
│  5. Generate QA report                                   │
└────────────────────┬────────────────────────────────────┘
                     │
         ┌───────────┴───────────┐
         │                       │
    ┌────▼────┐            ┌─────▼─────┐
    │ PASSED  │            │  FAILED   │
    │         │            │           │
    │ Merge   │            │ QA Fixer  │
    │ Ready   │            │ Agent     │
    └─────────┘            └─────┬─────┘
                                 │
                           ┌─────▼─────┐
                           │ Fix Issue │
                           │ Re-test   │
                           └───────────┘
```

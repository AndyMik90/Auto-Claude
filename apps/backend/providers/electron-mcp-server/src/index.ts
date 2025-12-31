#!/usr/bin/env node
/**
 * Auto Claude Extended Electron MCP Server
 *
 * Provides enhanced Chrome DevTools Protocol (CDP) tools for AI agents.
 * Extends base Electron automation with network, storage, performance,
 * emulation, and DOM inspection capabilities.
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import CDP from 'chrome-remote-interface';

// CDP client instance
let cdpClient: any = null;
let target: any = null;

// Network logs storage
const networkLogs: any[] = [];
let profilerStarted = false;
let consoleLogs: any[] = [];
let exceptions: any[] = [];

/**
 * Connect to Electron app via CDP
 */
async function connectToCDP(debugPort: number = 9222): Promise<boolean> {
  try {
    const targets = await CDP.List({ port: debugPort });
    const pageTarget = targets.find((t: any) => t.type === 'page');

    if (!pageTarget) {
      console.error('No page target found');
      return false;
    }

    target = pageTarget;
    cdpClient = await CDP({ target, port: debugPort });

    // Enable domains
    await Promise.all([
      cdpClient.Page.enable(),
      cdpClient.Runtime.enable(),
      cdpClient.Network.enable(),
      cdpClient.DOM.enable(),
      cdpClient.Log.enable(),
      cdpClient.Performance.enable(),
      cdpClient.Input.enable(),
    ]);

    // Set up network monitoring
    cdpClient.Network.requestWillBeSent((params: any) => {
      networkLogs.push({ type: 'request', ...params });
    });
    cdpClient.Network.responseReceived((params: any) => {
      networkLogs.push({ type: 'response', ...params });
    });

    // Set up console monitoring
    cdpClient.Runtime.consoleAPICalled((params: any) => {
      consoleLogs.push(params);
    });

    // Set up exception monitoring
    cdpClient.Runtime.exceptionThrown((params: any) => {
      exceptions.push(params);
    });

    console.error(`Connected to Electron on port ${debugPort}`);
    return true;
  } catch (error) {
    console.error('Failed to connect to CDP:', error);
    return false;
  }
}

/**
 * Ensure CDP connection is active
 */
async function ensureCDPConnection(): Promise<boolean> {
  if (cdpClient) {
    try {
      await cdpClient.Runtime.evaluate({ expression: '1+1' });
      return true;
    } catch {
      cdpClient = null;
    }
  }

  const debugPort = parseInt(process.env.ELECTRON_DEBUG_PORT || '9222', 10);
  return await connectToCDP(debugPort);
}

/**
 * Main server function
 */
async function main() {
  const server = new Server(
    {
      name: '@auto-claude/electron-mcp-server',
      version: '1.0.0',
    },
    {
      capabilities: {
        tools: {},
      },
    }
  );

  // Handle list tools request
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
      tools: [
        // Base tools
        {
          name: 'mcp__electron__get_electron_window_info',
          description: 'Get information about running Electron windows',
          inputSchema: {
            type: 'object',
            properties: {},
          },
        },
        {
          name: 'mcp__electron__take_screenshot',
          description: 'Capture screenshot of Electron window (compressed to 1280x720, JPEG quality 60)',
          inputSchema: {
            type: 'object',
            properties: {
              format: {
                type: 'string',
                enum: ['jpeg', 'png'],
                description: 'Image format (default: jpeg for compression)',
              },
              quality: {
                type: 'number',
                minimum: 0,
                maximum: 100,
                description: 'JPEG quality 0-100 (default: 60 for compression)',
              },
            },
          },
        },
        {
          name: 'mcp__electron__send_command_to_electron',
          description: 'Send commands to Electron app (click, fill, evaluate JS, etc.)',
          inputSchema: {
            type: 'object',
            properties: {
              command: {
                type: 'string',
                enum: [
                  'get_page_structure',
                  'click_by_text',
                  'click_by_selector',
                  'fill_input',
                  'select_option',
                  'send_keyboard_shortcut',
                  'navigate_to_hash',
                  'eval',
                  'debug_elements',
                  'verify_form_state',
                ],
                description: 'Command to execute',
              },
              args: {
                type: 'object',
                description: 'Command arguments',
              },
            },
            required: ['command'],
          },
        },
        {
          name: 'mcp__electron__read_electron_logs',
          description: 'Read console logs from Electron app',
          inputSchema: {
            type: 'object',
            properties: {
              logType: {
                type: 'string',
                enum: ['console', 'error'],
                description: 'Type of logs to read',
              },
              lines: {
                type: 'number',
                description: 'Number of recent log lines to retrieve',
              },
            },
          },
        },
        // Network tools
        {
          name: 'mcp__electron__get_network_logs',
          description: 'Get HTTP request/response history with filtering',
          inputSchema: {
            type: 'object',
            properties: {
              urlFilter: {
                type: 'string',
                description: 'Filter by URL pattern (optional)',
              },
              limit: {
                type: 'number',
                description: 'Maximum number of requests to return',
              },
            },
          },
        },
        {
          name: 'mcp__electron__get_request_details',
          description: 'Get full request headers and body for a specific request',
          inputSchema: {
            type: 'object',
            properties: {
              requestId: {
                type: 'string',
                description: 'Network request ID',
              },
            },
            required: ['requestId'],
          },
        },
        {
          name: 'mcp__electron__get_performance_timing',
          description: 'Get resource timing metrics for network requests',
          inputSchema: {
            type: 'object',
            properties: {
              urlFilter: {
                type: 'string',
                description: 'Filter by URL pattern (optional)',
              },
            },
          },
        },
        // Storage tools
        {
          name: 'mcp__electron__get_storage',
          description: 'Read localStorage or sessionStorage',
          inputSchema: {
            type: 'object',
            properties: {
              storageType: {
                type: 'string',
                enum: ['localStorage', 'sessionStorage'],
                description: 'Type of storage to read',
              },
            },
            required: ['storageType'],
          },
        },
        {
          name: 'mcp__electron__set_storage',
          description: 'Write items to localStorage or sessionStorage',
          inputSchema: {
            type: 'object',
            properties: {
              storageType: {
                type: 'string',
                enum: ['localStorage', 'sessionStorage'],
                description: 'Type of storage to write',
              },
              key: {
                type: 'string',
                description: 'Storage key',
              },
              value: {
                type: 'string',
                description: 'Storage value',
              },
            },
            required: ['storageType', 'key', 'value'],
          },
        },
        {
          name: 'mcp__electron__clear_storage',
          description: 'Clear all localStorage or sessionStorage',
          inputSchema: {
            type: 'object',
            properties: {
              storageType: {
                type: 'string',
                enum: ['localStorage', 'sessionStorage', 'all'],
                description: 'Type of storage to clear',
              },
            },
            required: ['storageType'],
          },
        },
        {
          name: 'mcp__electron__get_cookies',
          description: 'Get all cookies for current page',
          inputSchema: {
            type: 'object',
            properties: {},
          },
        },
        {
          name: 'mcp__electron__get_app_state',
          description: 'Get full application state snapshot (localStorage, sessionStorage, cookies)',
          inputSchema: {
            type: 'object',
            properties: {},
          },
        },
        // Performance tools
        {
          name: 'mcp__electron__get_metrics',
          description: 'Get web vitals (FCP, LCP, TTI, FPS)',
          inputSchema: {
            type: 'object',
            properties: {},
          },
        },
        {
          name: 'mcp__electron__get_memory_usage',
          description: 'Get heap size and used memory',
          inputSchema: {
            type: 'object',
            properties: {},
          },
        },
        {
          name: 'mcp__electron__start_profiling',
          description: 'Start CPU profiling',
          inputSchema: {
            type: 'object',
            properties: {},
          },
        },
        {
          name: 'mcp__electron__stop_profiling',
          description: 'Stop CPU profiling and get results',
          inputSchema: {
            type: 'object',
            properties: {},
          },
        },
        // Emulation tools
        {
          name: 'mcp__electron__set_device',
          description: 'Emulate mobile or tablet device',
          inputSchema: {
            type: 'object',
            properties: {
              device: {
                type: 'string',
                enum: ['iPhone 12', 'iPhone 12 Pro', 'iPhone SE', 'iPad Pro', 'Pixel 5', 'Galaxy S20'],
                description: 'Device to emulate',
              },
            },
            required: ['device'],
          },
        },
        {
          name: 'mcp__electron__set_network_throttle',
          description: 'Set network throttling profile',
          inputSchema: {
            type: 'object',
            properties: {
              profile: {
                type: 'string',
                enum: ['offline', 'slow-3g', 'fast-3g', 'online'],
                description: 'Network profile',
              },
            },
            required: ['profile'],
          },
        },
        {
          name: 'mcp__electron__set_geolocation',
          description: 'Set geolocation for testing',
          inputSchema: {
            type: 'object',
            properties: {
              latitude: { type: 'number', description: 'Latitude' },
              longitude: { type: 'number', description: 'Longitude' },
              accuracy: { type: 'number', description: 'Accuracy in meters' },
            },
            required: ['latitude', 'longitude'],
          },
        },
        {
          name: 'mcp__electron__set_theme',
          description: 'Toggle dark/light mode',
          inputSchema: {
            type: 'object',
            properties: {
              theme: {
                type: 'string',
                enum: ['dark', 'light', 'system'],
                description: 'Theme to set',
              },
            },
            required: ['theme'],
          },
        },
        // Enhanced DOM tools
        {
          name: 'mcp__electron__drag_and_drop',
          description: 'Drag element to target',
          inputSchema: {
            type: 'object',
            properties: {
              fromSelector: { type: 'string', description: 'CSS selector for draggable element' },
              toSelector: { type: 'string', description: 'CSS selector for drop target' },
            },
            required: ['fromSelector', 'toSelector'],
          },
        },
        {
          name: 'mcp__electron__right_click',
          description: 'Right-click element (context menu)',
          inputSchema: {
            type: 'object',
            properties: {
              selector: { type: 'string', description: 'CSS selector for element' },
            },
            required: ['selector'],
          },
        },
        {
          name: 'mcp__electron__hover',
          description: 'Hover over element',
          inputSchema: {
            type: 'object',
            properties: {
              selector: { type: 'string', description: 'CSS selector for element' },
            },
            required: ['selector'],
          },
        },
        {
          name: 'mcp__electron__scroll_to_element',
          description: 'Smooth scroll to element',
          inputSchema: {
            type: 'object',
            properties: {
              selector: { type: 'string', description: 'CSS selector for element' },
              smooth: { type: 'boolean', description: 'Use smooth scrolling (default: true)' },
            },
            required: ['selector'],
          },
        },
        {
          name: 'mcp__electron__get_element_state',
          description: 'Get element state (disabled, hidden, visible)',
          inputSchema: {
            type: 'object',
            properties: {
              selector: { type: 'string', description: 'CSS selector for element' },
            },
            required: ['selector'],
          },
        },
        // Console tools
        {
          name: 'mcp__electron__get_logs_filtered',
          description: 'Get filtered console logs by level or regex',
          inputSchema: {
            type: 'object',
            properties: {
              level: {
                type: 'string',
                enum: ['error', 'warning', 'info', 'log', 'debug'],
                description: 'Log level to filter',
              },
              pattern: { type: 'string', description: 'Regex pattern to filter messages' },
              limit: { type: 'number', description: 'Maximum number of logs to return' },
            },
          },
        },
        {
          name: 'mcp__electron__track_exceptions',
          description: 'Track JavaScript exceptions',
          inputSchema: {
            type: 'object',
            properties: {
              clear: { type: 'boolean', description: 'Clear tracked exceptions (default: false)' },
            },
          },
        },
        {
          name: 'mcp__electron__get_console_history',
          description: 'Get full console history',
          inputSchema: {
            type: 'object',
            properties: {
              limit: { type: 'number', description: 'Maximum number of entries (default: 100)' },
            },
          },
        },
      ],
    };
  });

  // Handle tool execution
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args = {} } = request.params;

    const connected = await ensureCDPConnection();
    if (!connected || !cdpClient) {
      return {
        content: [
          {
            type: 'text',
            text: 'Error: Could not connect to Electron app. Ensure ELECTRON_MCP_ENABLED=true and app is running with --remote-debugging-port',
          },
        ],
        isError: true,
      };
    }

    try {
      switch (name) {
        // Base tools
        case 'mcp__electron__get_electron_window_info':
          return await handleGetWindowInfo();
        case 'mcp__electron__take_screenshot':
          return await handleScreenshot(args);
        case 'mcp__electron__send_command_to_electron':
          return await handleSendCommand(args);
        case 'mcp__electron__read_electron_logs':
          return await handleReadLogs(args);

        // Network tools
        case 'mcp__electron__get_network_logs':
          return await handleGetNetworkLogs(args);
        case 'mcp__electron__get_request_details':
          return await handleGetRequestDetails(args);
        case 'mcp__electron__get_performance_timing':
          return await handleGetPerformanceTiming(args);

        // Storage tools
        case 'mcp__electron__get_storage':
          return await handleGetStorage(args);
        case 'mcp__electron__set_storage':
          return await handleSetStorage(args);
        case 'mcp__electron__clear_storage':
          return await handleClearStorage(args);
        case 'mcp__electron__get_cookies':
          return await handleGetCookies();
        case 'mcp__electron__get_app_state':
          return await handleGetAppState();

        // Performance tools
        case 'mcp__electron__get_metrics':
          return await handleGetMetrics();
        case 'mcp__electron__get_memory_usage':
          return await handleGetMemoryUsage();
        case 'mcp__electron__start_profiling':
          return await handleStartProfiling();
        case 'mcp__electron__stop_profiling':
          return await handleStopProfiling();

        // Emulation tools
        case 'mcp__electron__set_device':
          return await handleSetDevice(args);
        case 'mcp__electron__set_network_throttle':
          return await handleSetNetworkThrottle(args);
        case 'mcp__electron__set_geolocation':
          return await handleSetGeolocation(args);
        case 'mcp__electron__set_theme':
          return await handleSetTheme(args);

        // DOM tools
        case 'mcp__electron__drag_and_drop':
          return await handleDragAndDrop(args);
        case 'mcp__electron__right_click':
          return await handleRightClick(args);
        case 'mcp__electron__hover':
          return await handleHover(args);
        case 'mcp__electron__scroll_to_element':
          return await handleScrollToElement(args);
        case 'mcp__electron__get_element_state':
          return await handleGetElementState(args);

        // Console tools
        case 'mcp__electron__get_logs_filtered':
          return await handleGetLogsFiltered(args);
        case 'mcp__electron__track_exceptions':
          return await handleTrackExceptions(args);
        case 'mcp__electron__get_console_history':
          return await handleGetConsoleHistory(args);

        default:
          return {
            content: [{ type: 'text', text: `Error: Unknown tool: ${name}` }],
            isError: true,
          };
      }
    } catch (error: any) {
      return {
        content: [{ type: 'text', text: `Error: ${error.message}` }],
        isError: true,
      };
    }
  });

  // Start server
  const transport = new StdioServerTransport();
  await server.connect(transport);

  console.error('@auto-claude/electron-mcp-server running on stdio');
}

// Command handlers

async function handleGetWindowInfo() {
  const result = await cdpClient.Page.getLayoutMetrics();
  const url = await cdpClient.Runtime.evaluate({
    expression: 'window.location.href',
    returnByValue: true,
  });
  const title = await cdpClient.Runtime.evaluate({
    expression: 'document.title',
    returnByValue: true,
  });

  return {
    content: [{
      type: 'text',
      text: JSON.stringify({
        connected: true,
        url: url.result.value,
        viewport: {
          width: Math.round(result.contentSize.width),
          height: Math.round(result.contentSize.height),
        },
        title: title.result.value,
      }, null, 2),
    }],
  };
}

async function handleScreenshot(args: any) {
  const { format = 'jpeg', quality = 60 } = args;
  const screenshot = await cdpClient.Page.captureScreenshot({
    format,
    quality: format === 'jpeg' ? quality : undefined,
  });

  return {
    content: [{
      type: 'image',
      data: screenshot.data,
      mimeType: `image/${format}`,
    }],
  };
}

async function handleSendCommand(args: any) {
  const { command, args: cmdArgs = {} } = args;

  const result = await cdpClient.Runtime.evaluate({
    expression: `(() => {
      switch ('${command}') {
        case 'get_page_structure':
          return JSON.stringify({
            buttons: Array.from(document.querySelectorAll('button')).map(el => ({
              tag: 'button', text: el.textContent?.trim(), id: el.id, class: el.className
            })),
            inputs: Array.from(document.querySelectorAll('input, textarea')).map(el => ({
              tag: el.tagName.toLowerCase(), type: el.type, id: el.id, name: el.name
            })),
          });
        case 'click_by_text':
          const el = Array.from(document.querySelectorAll('*')).find(e => e.textContent?.trim() === '${cmdArgs.text || ''}');
          if (el) { el.click(); return JSON.stringify({ success: true }); }
          return JSON.stringify({ success: false, error: 'Not found' });
        case 'click_by_selector':
          const sel = document.querySelector('${cmdArgs.selector || ''}');
          if (sel) { sel.click(); return JSON.stringify({ success: true }); }
          return JSON.stringify({ success: false, error: 'Not found' });
        case 'fill_input':
          const inp = document.querySelector('${cmdArgs.selector || ''}');
          if (inp) { inp.value = '${cmdArgs.value || ''}'; inp.dispatchEvent(new Event('input')); return JSON.stringify({ success: true }); }
          return JSON.stringify({ success: false, error: 'Not found' });
        case 'eval':
          return JSON.stringify(${cmdArgs.code || 'null'});
        default:
          return JSON.stringify({ error: 'Unknown command' });
      }
    })()`,
    returnByValue: true,
  });

  return {
    content: [{ type: 'text', text: result.result.value }],
  };
}

async function handleReadLogs(args: any) {
  const { logType = 'console', lines = 50 } = args;
  const logEntries = await cdpClient.Log.getAndClear();

  const filtered = logEntries
    .filter((entry: any) => logType === 'error' ? entry.level === 'error' : true)
    .slice(-lines);

  return {
    content: [{
      type: 'text',
      text: filtered.length > 0
        ? filtered.map((e: any) => `[${e.level}] ${e.text}`).join('\n')
        : 'No logs found',
    }],
  };
}

async function handleGetNetworkLogs(args: any) {
  const { urlFilter, limit } = args;
  let filtered = networkLogs;
  if (urlFilter) {
    filtered = filtered.filter((log: any) => log.request?.url?.includes(urlFilter));
  }
  if (limit) {
    filtered = filtered.slice(-limit);
  }
  return {
    content: [{ type: 'text', text: JSON.stringify(filtered, null, 2) }],
  };
}

async function handleGetRequestDetails(args: any) {
  const { requestId } = args;
  try {
    const body = await cdpClient.Network.getResponseBody({ requestId });
    return {
      content: [{ type: 'text', text: JSON.stringify(body, null, 2) }],
    };
  } catch (e: any) {
    return {
      content: [{ type: 'text', text: `Error: ${e.message}` }],
      isError: true,
    };
  }
}

async function handleGetPerformanceTiming(args: any) {
  const metrics = await cdpClient.Performance.getMetrics();
  return {
    content: [{ type: 'text', text: JSON.stringify(metrics, null, 2) }],
  };
}

async function handleGetStorage(args: any) {
  const { storageType } = args;
  const result = await cdpClient.Runtime.evaluate({
    expression: `JSON.stringify({...window['${storageType}']})`,
    returnByValue: true,
  });
  return {
    content: [{ type: 'text', text: result.result.value }],
  };
}

async function handleSetStorage(args: any) {
  const { storageType, key, value } = args;
  await cdpClient.Runtime.evaluate({
    expression: `window['${storageType}'].setItem('${key}', '${value}')`,
  });
  return {
    content: [{ type: 'text', text: `Set ${key} in ${storageType}` }],
  };
}

async function handleClearStorage(args: any) {
  const { storageType } = args;
  if (storageType === 'all') {
    await cdpClient.Runtime.evaluate({
      expression: 'localStorage.clear(); sessionStorage.clear()',
    });
  } else {
    await cdpClient.Runtime.evaluate({
      expression: `window['${storageType}'].clear()`,
    });
  }
  return {
    content: [{ type: 'text', text: `Cleared ${storageType}` }],
  };
}

async function handleGetCookies() {
  const cookies = await cdpClient.Network.getCookies();
  return {
    content: [{ type: 'text', text: JSON.stringify(cookies, null, 2) }],
  };
}

async function handleGetAppState() {
  const result = await cdpClient.Runtime.evaluate({
    expression: `JSON.stringify({
      localStorage: {...localStorage},
      sessionStorage: {...sessionStorage},
      url: window.location.href
    })`,
    returnByValue: true,
  });
  return {
    content: [{ type: 'text', text: result.result.value }],
  };
}

async function handleGetMetrics() {
  const metrics = await cdpClient.Performance.getMetrics();
  return {
    content: [{ type: 'text', text: JSON.stringify(metrics, null, 2) }],
  };
}

async function handleGetMemoryUsage() {
  const heap = await cdpClient.Runtime.getHeapUsage();
  return {
    content: [{ type: 'text', text: JSON.stringify(heap, null, 2) }],
  };
}

async function handleStartProfiling() {
  if (!profilerStarted) {
    await cdpClient.Profiler.enable();
    await cdpClient.Profiler.start();
    profilerStarted = true;
  }
  return {
    content: [{ type: 'text', text: 'Profiling started' }],
  };
}

async function handleStopProfiling() {
  if (profilerStarted) {
    const profile = await cdpClient.Profiler.stop();
    profilerStarted = false;
    return {
      content: [{ type: 'text', text: JSON.stringify(profile, null, 2) }],
    };
  }
  return {
    content: [{ type: 'text', text: 'No active profiling session' }],
  };
}

async function handleSetDevice(args: any) {
  const { device } = args;
  const devices: Record<string, any> = {
    'iPhone 12': { width: 390, height: 844, mobile: true },
    'iPad Pro': { width: 1024, height: 1366, mobile: true },
    'Pixel 5': { width: 393, height: 851, mobile: true },
  };
  const viewport = devices[device] || devices['iPhone 12'];
  await cdpClient.Emulation.setDeviceMetricsOverride({
    width: viewport.width,
    height: viewport.height,
    mobile: viewport.mobile,
    deviceScaleFactor: 0,
  });
  return {
    content: [{ type: 'text', text: `Set device to ${device}` }],
  };
}

async function handleSetNetworkThrottle(args: any) {
  const { profile } = args;
  const profiles: Record<string, any> = {
    'offline': { offline: true, downloadThroughput: 0, uploadThroughput: 0, latency: 0 },
    'slow-3g': { offline: false, downloadThroughput: 500 * 1024 / 8, uploadThroughput: 500 * 1024 / 8, latency: 400 },
    'fast-3g': { offline: false, downloadThroughput: 1.6 * 1024 * 1024 / 8, uploadThroughput: 750 * 1024 / 8, latency: 100 },
  };
  const conditions = profiles[profile];
  if (conditions) {
    await cdpClient.Network.emulateNetworkConditions(conditions);
  }
  return {
    content: [{ type: 'text', text: `Set network to ${profile}` }],
  };
}

async function handleSetGeolocation(args: any) {
  const { latitude, longitude, accuracy = 100 } = args;
  await cdpClient.Emulation.setGeolocationOverride({ latitude, longitude, accuracy });
  return {
    content: [{ type: 'text', text: `Set geolocation to ${latitude}, ${longitude}` }],
  };
}

async function handleSetTheme(args: any) {
  const { theme } = args;
  await cdpClient.Runtime.evaluate({
    expression: `document.documentElement.setAttribute('data-theme', '${theme}')`,
  });
  return {
    content: [{ type: 'text', text: `Set theme to ${theme}` }],
  };
}

async function handleDragAndDrop(args: any) {
  const { fromSelector, toSelector } = args;
  await cdpClient.Runtime.evaluate({
    expression: `
      (() => {
        const from = document.querySelector('${fromSelector}');
        const to = document.querySelector('${toSelector}');
        if (!from || !to) return { error: 'Elements not found' };
        from.dispatchEvent(new DragEvent('dragstart', { bubbles: true }));
        to.dispatchEvent(new DragEvent('drop', { bubbles: true }));
        return { success: true };
      })()
    `,
    returnByValue: true,
  });
  return {
    content: [{ type: 'text', text: 'Drag and drop executed' }],
  };
}

async function handleRightClick(args: any) {
  const { selector } = args;
  await cdpClient.Runtime.evaluate({
    expression: `document.querySelector('${selector}')?.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true }))`,
  });
  return {
    content: [{ type: 'text', text: `Right-clicked ${selector}` }],
  };
}

async function handleHover(args: any) {
  const { selector } = args;
  await cdpClient.Runtime.evaluate({
    expression: `document.querySelector('${selector}')?.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }))`,
  });
  return {
    content: [{ type: 'text', text: `Hovered ${selector}` }],
  };
}

async function handleScrollToElement(args: any) {
  const { selector, smooth = true } = args;
  await cdpClient.Runtime.evaluate({
    expression: `document.querySelector('${selector}')?.scrollIntoView({ behavior: '${smooth ? 'smooth' : 'auto'}', block: 'center' })`,
  });
  return {
    content: [{ type: 'text', text: `Scrolled to ${selector}` }],
  };
}

async function handleGetElementState(args: any) {
  const { selector } = args;
  const result = await cdpClient.Runtime.evaluate({
    expression: `
      (() => {
        const el = document.querySelector('${selector}');
        if (!el) return { error: 'Not found' };
        const rect = el.getBoundingClientRect();
        return {
          visible: rect.width > 0 && rect.height > 0,
          disabled: el.disabled || false,
          focused: document.activeElement === el,
        };
      })()
    `,
    returnByValue: true,
  });
  return {
    content: [{ type: 'text', text: JSON.stringify(result.result.value, null, 2) }],
  };
}

async function handleGetLogsFiltered(args: any) {
  const { level, pattern, limit } = args;
  let filtered = consoleLogs;
  if (level) {
    filtered = filtered.filter((log: any) => log.type === level);
  }
  if (pattern) {
    const regex = new RegExp(pattern);
    filtered = filtered.filter((log: any) => regex.test(log.args?.join(' ')));
  }
  if (limit) {
    filtered = filtered.slice(-limit);
  }
  return {
    content: [{ type: 'text', text: JSON.stringify(filtered, null, 2) }],
  };
}

async function handleTrackExceptions(args: any) {
  const { clear = false } = args;
  if (clear) {
    exceptions = [];
  }
  return {
    content: [{ type: 'text', text: JSON.stringify(exceptions, null, 2) }],
  };
}

async function handleGetConsoleHistory(args: any) {
  const { limit = 100 } = args;
  return {
    content: [{ type: 'text', text: JSON.stringify(consoleLogs.slice(-limit), null, 2) }],
  };
}

// Start the server
main().catch((error) => {
  console.error('Server error:', error);
  process.exit(1);
});

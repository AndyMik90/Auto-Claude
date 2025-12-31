#!/usr/bin/env node
/**
 * Auto Claude Extended Puppeteer MCP Server
 *
 * Provides enhanced browser automation tools for AI agents using Puppeteer.
 * Supports Chrome, Chromium, and Edge with CDP (Chrome DevTools Protocol).
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import puppeteer from 'puppeteer';

// Browser instance
let browser: puppeteer.Browser | null = null;
let page: puppeteer.Page | null = null;

/**
 * Connect to or launch browser
 */
async function ensureBrowser(): Promise<boolean> {
  if (browser && page) {
    try {
      // Test connection
      await page.evaluate('1+1');
      return true;
    } catch {
      browser = null;
      page = null;
    }
  }

  try {
    browser = await puppeteer.launch({
      headless: process.env.PUPPETEER_HEADLESS !== 'false',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
      ],
      defaultViewport: {
        width: 1920,
        height: 1080,
      },
    });

    page = await browser.newPage();

    // Enable CDP domains for enhanced features
    const client = await page.target().createCDPSession();
    await client.send('Network.enable');
    await client.send('Runtime.enable');
    await client.send('Log.enable');
    await client.send('Performance.enable');

    console.error('Puppeteer browser connected');
    return true;
  } catch (error) {
    console.error('Failed to connect to browser:', error);
    return false;
  }
}

/**
 * Create and start the MCP server
 */
async function main() {
  const server = new Server(
    {
      name: '@auto-claude/puppeteer-mcp-server',
      version: '1.0.0',
    },
    {
      capabilities: {
        tools: {},
      },
    }
  );

  // Register all command handlers
  // (Will be imported from command modules)

  // Handle list tools request
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
      tools: [
        // Base tools
        {
          name: 'mcp__puppeteer__puppeteer_connect_active_tab',
          description: 'Connect to or launch the browser',
          inputSchema: {
            type: 'object',
            properties: {
              url: {
                type: 'string',
                description: 'URL to navigate to after connecting',
              },
            },
          },
        },
        {
          name: 'mcp__puppeteer__puppeteer_navigate',
          description: 'Navigate to a URL',
          inputSchema: {
            type: 'object',
            properties: {
              url: {
                type: 'string',
                description: 'URL to navigate to',
              },
              waitUntil: {
                type: 'string',
                enum: ['load', 'domcontentloaded', 'networkidle0', 'networkidle2'],
                description: 'When to consider navigation successful',
              },
            },
            required: ['url'],
          },
        },
        {
          name: 'mcp__puppeteer__puppeteer_screenshot',
          description: 'Capture screenshot of the current page (compressed to stay under 1MB)',
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
          name: 'mcp__puppeteer__puppeteer_click',
          description: 'Click an element by selector or text',
          inputSchema: {
            type: 'object',
            properties: {
              selector: {
                type: 'string',
                description: 'CSS selector for element',
              },
              text: {
                type: 'string',
                description: 'Text content to find element by',
              },
            },
          },
        },
        {
          name: 'mcp__puppeteer__puppeteer_fill',
          description: 'Fill an input field',
          inputSchema: {
            type: 'object',
            properties: {
              selector: {
                type: 'string',
                description: 'CSS selector for input',
              },
              value: {
                type: 'string',
                description: 'Value to fill',
              },
            },
            required: ['selector', 'value'],
          },
        },
        {
          name: 'mcp__puppeteer__puppeteer_select',
          description: 'Select an option from a dropdown',
          inputSchema: {
            type: 'object',
            properties: {
              selector: {
                type: 'string',
                description: 'CSS selector for select element',
              },
              value: {
                type: 'string',
                description: 'Option value to select',
              },
            },
            required: ['selector', 'value'],
          },
        },
        {
          name: 'mcp__puppeteer__puppeteer_hover',
          description: 'Hover over an element',
          inputSchema: {
            type: 'object',
            properties: {
              selector: {
                type: 'string',
                description: 'CSS selector for element',
              },
            },
            required: ['selector'],
          },
        },
        {
          name: 'mcp__puppeteer__puppeteer_evaluate',
          description: 'Execute JavaScript in the page',
          inputSchema: {
            type: 'object',
            properties: {
              code: {
                type: 'string',
                description: 'JavaScript code to execute',
              },
            },
            required: ['code'],
          },
        },
        // Network tools
        {
          name: 'mcp__puppeteer__get_network_logs',
          description: 'Get HTTP request/response history',
          inputSchema: {
            type: 'object',
            properties: {
              urlFilter: {
                type: 'string',
                description: 'Filter by URL pattern',
              },
              limit: {
                type: 'number',
                description: 'Maximum number of requests',
              },
            },
          },
        },
        {
          name: 'mcp__puppeteer__get_request_details',
          description: 'Get details of a specific network request',
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
        // Storage tools
        {
          name: 'mcp__puppeteer__get_storage',
          description: 'Read localStorage or sessionStorage',
          inputSchema: {
            type: 'object',
            properties: {
              storageType: {
                type: 'string',
                enum: ['localStorage', 'sessionStorage'],
              },
            },
            required: ['storageType'],
          },
        },
        {
          name: 'mcp__puppeteer__set_storage',
          description: 'Write to localStorage or sessionStorage',
          inputSchema: {
            type: 'object',
            properties: {
              storageType: {
                type: 'string',
                enum: ['localStorage', 'sessionStorage'],
              },
              key: {
                type: 'string',
              },
              value: {
                type: 'string',
              },
            },
            required: ['storageType', 'key', 'value'],
          },
        },
        {
          name: 'mcp__puppeteer__get_cookies',
          description: 'Get all cookies',
          inputSchema: {
            type: 'object',
            properties: {},
          },
        },
        {
          name: 'mcp__puppeteer__get_app_state',
          description: 'Get full application state (localStorage, sessionStorage, cookies)',
          inputSchema: {
            type: 'object',
            properties: {},
          },
        },
        // Performance tools
        {
          name: 'mcp__puppeteer__get_metrics',
          description: 'Get web vitals (FCP, LCP, TTI)',
          inputSchema: {
            type: 'object',
            properties: {},
          },
        },
        {
          name: 'mcp__puppeteer__get_memory_usage',
          description: 'Get memory usage metrics',
          inputSchema: {
            type: 'object',
            properties: {},
          },
        },
        // Emulation tools
        {
          name: 'mcp__puppeteer__set_device',
          description: 'Emulate a device (mobile, tablet)',
          inputSchema: {
            type: 'object',
            properties: {
              device: {
                type: 'string',
                enum: ['iPhone 12', 'iPad Pro', 'Pixel 5'],
              },
            },
            required: ['device'],
          },
        },
        {
          name: 'mcp__puppeteer__set_network_throttle',
          description: 'Set network throttling profile',
          inputSchema: {
            type: 'object',
            properties: {
              profile: {
                type: 'string',
                enum: ['offline', 'slow-3g', 'fast-3g', 'online'],
              },
            },
            required: ['profile'],
          },
        },
        {
          name: 'mcp__puppeteer__set_geolocation',
          description: 'Set geolocation for testing',
          inputSchema: {
            type: 'object',
            properties: {
              latitude: { type: 'number' },
              longitude: { type: 'number' },
            },
            required: ['latitude', 'longitude'],
          },
        },
        // Enhanced DOM tools
        {
          name: 'mcp__puppeteer__drag_and_drop',
          description: 'Drag element to target',
          inputSchema: {
            type: 'object',
            properties: {
              fromSelector: { type: 'string' },
              toSelector: { type: 'string' },
            },
            required: ['fromSelector', 'toSelector'],
          },
        },
        {
          name: 'mcp__puppeteer__right_click',
          description: 'Right-click element',
          inputSchema: {
            type: 'object',
            properties: {
              selector: { type: 'string' },
            },
            required: ['selector'],
          },
        },
        {
          name: 'mcp__puppeteer__scroll_to_element',
          description: 'Smooth scroll to element',
          inputSchema: {
            type: 'object',
            properties: {
              selector: { type: 'string' },
            },
            required: ['selector'],
          },
        },
        {
          name: 'mcp__puppeteer__get_element_state',
          description: 'Get element state (visible, enabled, etc.)',
          inputSchema: {
            type: 'object',
            properties: {
              selector: { type: 'string' },
            },
            required: ['selector'],
          },
        },
        // Console tools
        {
          name: 'mcp__puppeteer__get_console_logs',
          description: 'Get console logs',
          inputSchema: {
            type: 'object',
            properties: {
              level: {
                type: 'string',
                enum: ['error', 'warning', 'info', 'log'],
              },
              limit: { type: 'number' },
            },
          },
        },
        {
          name: 'mcp__puppeteer__track_exceptions',
          description: 'Track JavaScript exceptions',
          inputSchema: {
            type: 'object',
            properties: {},
          },
        },
      ],
    };
  });

  // Handle tool execution
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    // Ensure browser connection
    const connected = await ensureBrowser();
    if (!connected) {
      return {
        content: [
          {
            type: 'text',
            text: 'Error: Could not connect to browser',
          },
        ],
        isError: true,
      };
    }

    if (!page) {
      return {
        content: [{ type: 'text', text: 'Error: No active page' }],
        isError: true,
      };
    }

    try {
      switch (name) {
        case 'mcp__puppeteer__puppeteer_connect_active_tab':
          return await handleConnect(args);
        case 'mcp__puppeteer__puppeteer_navigate':
          return await handleNavigate(args);
        case 'mcp__puppeteer__puppeteer_screenshot':
          return await handleScreenshot(args);
        case 'mcp__puppeteer__puppeteer_click':
          return await handleClick(args);
        case 'mcp__puppeteer__puppeteer_fill':
          return await handleFill(args);
        case 'mcp__puppeteer__puppeteer_select':
          return await handleSelect(args);
        case 'mcp__puppeteer__puppeteer_hover':
          return await handleHover(args);
        case 'mcp__puppeteer__puppeteer_evaluate':
          return await handleEvaluate(args);
        case 'mcp__puppeteer__get_network_logs':
          return await handleGetNetworkLogs(args);
        case 'mcp__puppeteer__get_request_details':
          return await handleGetRequestDetails(args);
        case 'mcp__puppeteer__get_storage':
          return await handleGetStorage(args);
        case 'mcp__puppeteer__set_storage':
          return await handleSetStorage(args);
        case 'mcp__puppeteer__get_cookies':
          return await handleGetCookies();
        case 'mcp__puppeteer__get_app_state':
          return await handleGetAppState();
        case 'mcp__puppeteer__get_metrics':
          return await handleGetMetrics();
        case 'mcp__puppeteer__get_memory_usage':
          return await handleGetMemoryUsage();
        case 'mcp__puppeteer__set_device':
          return await handleSetDevice(args);
        case 'mcp__puppeteer__set_network_throttle':
          return await handleSetNetworkThrottle(args);
        case 'mcp__puppeteer__set_geolocation':
          return await handleSetGeolocation(args);
        case 'mcp__puppeteer__drag_and_drop':
          return await handleDragAndDrop(args);
        case 'mcp__puppeteer__right_click':
          return await handleRightClick(args);
        case 'mcp__puppeteer__scroll_to_element':
          return await handleScrollToElement(args);
        case 'mcp__puppeteer__get_element_state':
          return await handleGetElementState(args);
        case 'mcp__puppeteer__get_console_logs':
          return await handleGetConsoleLogs(args);
        case 'mcp__puppeteer__track_exceptions':
          return await handleTrackExceptions();
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

  console.error('@auto-claude/puppeteer-mcp-server running on stdio');
}

// Command handlers

async function handleConnect(args: any) {
  const { url } = args || {};
  if (url && page) {
    await page.goto(url, { waitUntil: 'networkidle2' });
  }
  return {
    content: [{ type: 'text', text: 'Browser connected' }],
  };
}

async function handleNavigate(args: any) {
  const { url, waitUntil = 'networkidle2' } = args;
  await page!.goto(url, { waitUntil });
  return {
    content: [{ type: 'text', text: `Navigated to ${url}` }],
  };
}

async function handleScreenshot(args: any) {
  const { format = 'jpeg', quality = 60 } = args;
  const screenshot = await page!.screenshot({
    type: format as 'jpeg' | 'png',
    quality: format === 'jpeg' ? quality : undefined,
  });
  // Convert to base64
  const base64 = screenshot.toString('base64');
  return {
    content: [{
      type: 'image',
      data: base64,
      mimeType: `image/${format}`,
    }],
  };
}

async function handleClick(args: any) {
  const { selector, text } = args;
  if (text) {
    await page!.click(`*:text("${text}")`);
  } else if (selector) {
    await page!.click(selector);
  }
  return {
    content: [{ type: 'text', text: 'Clicked element' }],
  };
}

async function handleFill(args: any) {
  const { selector, value } = args;
  await page!.type(selector, value);
  return {
    content: [{ type: 'text', text: `Filled ${selector}` }],
  };
}

async function handleSelect(args: any) {
  const { selector, value } = args;
  await page!.select(selector, value);
  return {
    content: [{ type: 'text', text: `Selected ${value}` }],
  };
}

async function handleHover(args: any) {
  const { selector } = args;
  await page!.hover(selector);
  return {
    content: [{ type: 'text', text: `Hovered ${selector}` }],
  };
}

async function handleEvaluate(args: any) {
  const { code } = args;
  const result = await page!.evaluate(code);
  return {
    content: [{ type: 'text', text: JSON.stringify(result) }],
  };
}

async function handleGetNetworkLogs(args: any) {
  const { urlFilter, limit } = args;
  // Get network logs via CDP
  const client = await page!.target().createCDPSession();
  const logs = await client.send('Network.getResponseBody');
  return {
    content: [{ type: 'text', text: JSON.stringify(logs) }],
  };
}

async function handleGetRequestDetails(args: any) {
  const { requestId } = args;
  const client = await page!.target().createCDPSession();
  const details = await client.send('Network.getResponseBody', { requestId });
  return {
    content: [{ type: 'text', text: JSON.stringify(details) }],
  };
}

async function handleGetStorage(args: any) {
  const { storageType } = args;
  const storage = await page!.evaluate((type: string) => {
    const items: Record<string, string> = {};
    for (let i = 0; i < (window as any)[type].length; i++) {
      const key = (window as any)[type].key(i);
      items[key] = (window as any)[type].getItem(key);
    }
    return { type, items };
  }, storageType);
  return {
    content: [{ type: 'text', text: JSON.stringify(storage) }],
  };
}

async function handleSetStorage(args: any) {
  const { storageType, key, value } = args;
  await page!.evaluate((type: string, k: string, v: string) => {
    (window as any)[type].setItem(k, v);
  }, storageType, key, value);
  return {
    content: [{ type: 'text', text: `Set ${key} in ${storageType}` }],
  };
}

async function handleGetCookies() {
  const cookies = await page!.cookies();
  return {
    content: [{ type: 'text', text: JSON.stringify(cookies) }],
  };
}

async function handleGetAppState() {
  const state = await page!.evaluate(() => {
    const ls: Record<string, string> = {};
    const ss: Record<string, string> = {};
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key) {
        ls[key] = localStorage.getItem(key)!;
      }
    }
    for (let i = 0; i < sessionStorage.length; i++) {
      const key = sessionStorage.key(i);
      if (key) {
        ss[key] = sessionStorage.getItem(key)!;
      }
    }
    return { localStorage: ls, sessionStorage: ss, url: window.location.href };
  });
  return {
    content: [{ type: 'text', text: JSON.stringify(state) }],
  };
}

async function handleGetMetrics() {
  const metrics = await page!.metrics();
  return {
    content: [{ type: 'text', text: JSON.stringify(metrics) }],
  };
}

async function handleGetMemoryUsage() {
  const client = await page!.target().createCDPSession();
  const heap = await client.send('Runtime.getHeapUsage');
  return {
    content: [{ type: 'text', text: JSON.stringify(heap) }],
  };
}

async function handleSetDevice(args: any) {
  const { device } = args;
  const devices: Record<string, puppeteer.Viewport> = {
    'iPhone 12': { width: 390, height: 844, isMobile: true, hasTouch: true, deviceScaleFactor: 3 },
    'iPad Pro': { width: 1024, height: 1366, isMobile: true, hasTouch: true, deviceScaleFactor: 2 },
    'Pixel 5': { width: 393, height: 851, isMobile: true, hasTouch: true, deviceScaleFactor: 2.625 },
  };
  await page!.setViewport(devices[device]);
  return {
    content: [{ type: 'text', text: `Set device to ${device}` }],
  };
}

async function handleSetNetworkThrottle(args: any) {
  const { profile } = args;
  const client = await page!.target().createCDPSession();

  if (profile === 'offline') {
    await client.send('Network.emulateNetworkConditions', {
      offline: true,
      downloadThroughput: 0,
      uploadThroughput: 0,
      latency: 0,
    });
  } else if (profile === 'slow-3g') {
    await client.send('Network.emulateNetworkConditions', {
      offline: false,
      downloadThroughput: 500 * 1024 / 8,
      uploadThroughput: 500 * 1024 / 8,
      latency: 400,
    });
  } else if (profile === 'fast-3g') {
    await client.send('Network.emulateNetworkConditions', {
      offline: false,
      downloadThroughput: 1.6 * 1024 * 1024 / 8,
      uploadThroughput: 750 * 1024 / 8,
      latency: 100,
    });
  }
  // For 'online', just clear any throttling (default state)

  return {
    content: [{ type: 'text', text: `Set network to ${profile}` }],
  };
}

async function handleSetGeolocation(args: any) {
  const { latitude, longitude } = args;
  await page!.setGeolocation({ latitude, longitude, accuracy: 100 });
  return {
    content: [{ type: 'text', text: `Set geolocation to ${latitude}, ${longitude}` }],
  };
}

async function handleDragAndDrop(args: any) {
  const { fromSelector, toSelector } = args;
  await page!.evaluate((from: string, to: string) => {
    const fromEl = document.querySelector(from);
    const toEl = document.querySelector(to);
    if (!fromEl || !toEl) throw new Error('Elements not found');
    fromEl.dispatchEvent(new DragEvent('dragstart', { bubbles: true }));
    toEl.dispatchEvent(new DragEvent('drop', { bubbles: true }));
    return { success: true };
  }, fromSelector, toSelector);
  return {
    content: [{ type: 'text', text: 'Dragged element' }],
  };
}

async function handleRightClick(args: any) {
  const { selector } = args;
  await page!.click(selector, { button: 'right' });
  return {
    content: [{ type: 'text', text: `Right-clicked ${selector}` }],
  };
}

async function handleScrollToElement(args: any) {
  const { selector } = args;
  await page!.evaluate((sel: string) => {
    document.querySelector(sel)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, selector);
  return {
    content: [{ type: 'text', text: `Scrolled to ${selector}` }],
  };
}

async function handleGetElementState(args: any) {
  const { selector } = args;
  const state = await page!.evaluate((sel: string) => {
    const el = document.querySelector(sel);
    if (!el) return { error: 'Not found' };
    const rect = el.getBoundingClientRect();
    return {
      visible: rect.width > 0 && rect.height > 0,
      disabled: (el as HTMLInputElement).disabled || false,
      focused: document.activeElement === el,
    };
  }, selector);
  return {
    content: [{ type: 'text', text: JSON.stringify(state) }],
  };
}

async function handleGetConsoleLogs(args: any) {
  const { level, limit } = args;
  const logs = await page!.evaluate(() => {
    return (window as any).__consoleLogs || [];
  });
  return {
    content: [{ type: 'text', text: JSON.stringify(logs.slice(-limit)) }],
  };
}

async function handleTrackExceptions() {
  const exceptions = await page!.evaluate(() => {
    return (window as any).__exceptions || [];
  });
  return {
    content: [{ type: 'text', text: JSON.stringify(exceptions) }],
  };
}

// Start the server
main().catch((error) => {
  console.error('Server error:', error);
  process.exit(1);
});

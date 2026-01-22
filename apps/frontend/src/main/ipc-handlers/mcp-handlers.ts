/**
 * MCP Server Health Check Handlers
 *
 * Handles IPC requests for checking MCP server health and connectivity.
 */

import { ipcMain } from 'electron';
import { IPC_CHANNELS } from '../../shared/constants/ipc';
import type { CustomMcpServer, McpHealthCheckResult, McpHealthStatus, McpTestConnectionResult } from '../../shared/types/project';
import { spawn } from 'child_process';
import { appLog } from '../app-logger';

/**
 * Defense-in-depth: Frontend-side command validation
 * Mirrors the backend SAFE_COMMANDS allowlist to prevent arbitrary command execution
 * even if malicious configs somehow bypass backend validation
 */
const SAFE_COMMANDS = new Set(['npx', 'npm', 'node', 'python', 'python3', 'uv', 'uvx']);

/**
 * Defense-in-depth: Dangerous interpreter flags that allow code execution
 * Mirrors backend DANGEROUS_FLAGS to prevent args-based code injection
 */
const DANGEROUS_FLAGS = new Set([
  '--eval', '-e', '-c', '--exec',
  '-m', '-p', '--print',
  '--input-type=module', '--experimental-loader',
  '--require', '-r'
]);

/**
 * Defense-in-depth: Shell metacharacters that could enable command injection
 * when shell: true is used on Windows
 */
const SHELL_METACHARACTERS = ['&', '|', '>', '<', '^', '%', ';', '$', '`', '\n', '\r'];

/**
 * MCP client name constant for consistent identification across all requests
 */
const MCP_CLIENT_NAME = 'auto-claude-client';
const MCP_CLIENT_VERSION = '1.0.0';

/**
 * Create MCP initialize request object.
 * Extracted as shared factory to avoid DRY violation.
 */
function createMcpInitRequest() {
  return {
    jsonrpc: '2.0' as const,
    id: 1,
    method: 'initialize' as const,
    params: {
      protocolVersion: '2024-11-05',
      capabilities: {
        roots: { listChanged: true },
      },
      clientInfo: {
        name: MCP_CLIENT_NAME,
        version: MCP_CLIENT_VERSION,
      },
    },
  };
}

/**
 * Sensitive header keys that should be redacted in logs.
 * Uses substring matching via lowerKey.includes(), so entries like 'token'
 * will match 'x-access-token', 'x-refresh-token', 'x-auth-token', etc.
 */
const SENSITIVE_HEADER_KEYS = [
  // Standard auth headers
  'authorization',      // Authorization, Proxy-Authorization
  'cookie',             // Cookie, Set-Cookie
  'bearer',             // Bearer tokens

  // Token-based auth (substring matches many variants)
  'token',              // *-token, token-*, x-access-token, x-refresh-token, etc.
  'api-key',            // x-api-key, api-key
  'apikey',             // X-ApiKey, apikey (no hyphen variants)

  // OAuth and session
  'oauth',              // OAuth headers
  'session',            // Session IDs

  // AWS security
  'x-amz-security',     // x-amz-security-token
  'x-aws-security',     // x-aws-security-token

  // Secrets and credentials
  'secret',             // client-secret, x-secret, etc.
  'password',           // x-password, password headers
  'credential',         // credentials, x-credential

  // Authentication variants
  'x-auth',             // x-auth-*, authentication headers
  'authentication',     // Authentication header
];

/**
 * Redact sensitive values from headers for safe logging
 */
function redactSensitiveHeaders(headers: Record<string, string>): Record<string, string> {
  const safeHeaders: Record<string, string> = {};
  for (const [key, value] of Object.entries(headers)) {
    const lowerKey = key.toLowerCase();
    if (SENSITIVE_HEADER_KEYS.some(sensitive => lowerKey.includes(sensitive))) {
      safeHeaders[key] = '[REDACTED]';
    } else {
      safeHeaders[key] = value;
    }
  }
  return safeHeaders;
}

/**
 * Read response body with SSE stream support.
 * For SSE streams, performs a bounded read to avoid hanging on endless streams.
 * For regular responses, uses standard response.text().
 *
 * @param response - Fetch response object
 * @param contentType - Content-Type header value
 * @param timeoutMs - Timeout for SSE bounded read (default: 5000ms)
 * @returns Response text (may be partial for SSE streams)
 */
async function readResponseWithSSESupport(
  response: Response,
  contentType: string,
  timeoutMs: number = 5000
): Promise<string> {
  const isSSEContentType = contentType.includes('text/event-stream');

  if (!isSSEContentType || !response.body) {
    // Non-SSE response - use standard text() method
    return response.text();
  }

  // SSE stream - perform bounded read to avoid hanging
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let responseText = '';

  try {
    // Race between reading first chunk and timeout
    const readPromise = reader.read();
    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    const timeoutPromise = new Promise<{ done: true; value: undefined }>((resolve) => {
      timeoutId = setTimeout(() => resolve({ done: true, value: undefined }), timeoutMs);
    });

    const result = await Promise.race([readPromise, timeoutPromise]);
    if (timeoutId) clearTimeout(timeoutId);

    if (!result.done && result.value) {
      responseText = decoder.decode(result.value, { stream: false });
    }

    // Try to read more chunks with short timeout for complete SSE messages
    let additionalReads = 0;
    const maxAdditionalReads = 3;

    while (additionalReads < maxAdditionalReads) {
      let shortTimeoutId: ReturnType<typeof setTimeout> | undefined;
      const shortTimeoutPromise = new Promise<{ done: true; value: undefined }>((resolve) => {
        shortTimeoutId = setTimeout(() => resolve({ done: true, value: undefined }), 500);
      });

      const additionalResult = await Promise.race([reader.read(), shortTimeoutPromise]);
      if (shortTimeoutId) clearTimeout(shortTimeoutId);

      if (additionalResult.done || !additionalResult.value) {
        break;
      }

      responseText += decoder.decode(additionalResult.value, { stream: false });
      additionalReads++;

      // Stop if we have complete SSE data lines (require full data line with newline)
      if (responseText.includes('\n\n') || /data:.*\n/.test(responseText)) {
        break;
      }
    }
  } finally {
    // Clean up - cancel reader and release lock
    try {
      await reader.cancel();
    } catch {
      // Ignore cancel errors
    }
  }

  return responseText;
}

/**
 * Interface for MCP JSON-RPC response
 */
interface McpJsonRpcResponse {
  jsonrpc: string;
  /** JSON-RPC 2.0 id can be string, number, or null */
  id: string | number | null;
  result?: {
    protocolVersion?: string;
    capabilities?: Record<string, unknown>;
    serverInfo?: {
      name: string;
      version: string;
    };
    tools?: Array<{ name: string; description?: string }>;
  };
  error?: {
    code: number;
    message: string;
    data?: unknown;
  };
}

/**
 * Validate that a command is in the safe allowlist
 */
function isCommandSafe(command: string | undefined): boolean {
  if (!command) return false;
  // Reject commands with paths (defense against path traversal)
  if (command.includes('/') || command.includes('\\')) return false;
  return SAFE_COMMANDS.has(command);
}

/**
 * Validate that args don't contain dangerous interpreter flags or shell metacharacters
 */
function areArgsSafe(args: string[] | undefined): boolean {
  if (!args || args.length === 0) return true;

  // Check for dangerous interpreter flags
  if (args.some(arg => DANGEROUS_FLAGS.has(arg))) return false;

  // On Windows with shell: true, check for shell metacharacters that could enable injection
  if (process.platform === 'win32') {
    if (args.some(arg => SHELL_METACHARACTERS.some(char => arg.includes(char)))) {
      return false;
    }
  }

  return true;
}

/**
 * Quick health check for a custom MCP server.
 * For HTTP servers: makes a HEAD/GET request to check connectivity.
 * For command servers: checks if the command exists.
 */
async function checkMcpHealth(server: CustomMcpServer): Promise<McpHealthCheckResult> {
  const startTime = Date.now();

  if (server.type === 'http') {
    return checkHttpHealth(server, startTime);
  } else {
    return checkCommandHealth(server, startTime);
  }
}

/**
 * Check HTTP server health by making a request.
 */
async function checkHttpHealth(server: CustomMcpServer, startTime: number): Promise<McpHealthCheckResult> {
  if (!server.url) {
    return {
      serverId: server.id,
      status: 'unhealthy',
      message: 'No URL configured',
      checkedAt: new Date().toISOString(),
    };
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000); // 10 second timeout

    const headers: Record<string, string> = {
      'Accept': 'application/json, text/event-stream',
      'Content-Type': 'application/json',
    };

    // Add custom headers if configured
    if (server.headers) {
      Object.assign(headers, server.headers);
    }

    appLog.info('[MCP Health] Checking HTTP server:', server.url);
    appLog.debug('[MCP Health] Headers:', JSON.stringify(redactSensitiveHeaders(headers)));

    // Use POST with MCP initialize for health check (many MCP servers don't support GET)
    const initRequest = createMcpInitRequest();

    const response = await fetch(server.url, {
      method: 'POST',
      headers,
      body: JSON.stringify(initRequest),
      signal: controller.signal,
    });

    clearTimeout(timeout);
    const responseTime = Date.now() - startTime;

    appLog.info('[MCP Health] Response status:', response.status, response.statusText);

    let status: McpHealthStatus;
    let message: string;

    if (response.ok) {
      status = 'healthy';
      message = 'Server is responding';
    } else if (response.status === 401 || response.status === 403) {
      status = 'needs_auth';
      message = response.status === 401 ? 'Authentication required' : 'Access forbidden';
    } else {
      // Try to get error body for debugging
      try {
        const errorBody = await response.text();
        appLog.debug('[MCP Health] Error response:', errorBody.substring(0, 500));
      } catch (e) {
        appLog.debug('[MCP Health] Failed to get error response text:', e);
      }
      status = 'unhealthy';
      message = `HTTP ${response.status}: ${response.statusText}`;
    }

    return {
      serverId: server.id,
      status,
      statusCode: response.status,
      message,
      responseTime,
      checkedAt: new Date().toISOString(),
    };
  } catch (error) {
    const responseTime = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    // Check for specific error types
    const status: McpHealthStatus = 'unhealthy';
    let message = errorMessage;

    if (errorMessage.includes('abort') || errorMessage.includes('timeout')) {
      message = 'Connection timed out';
    } else if (errorMessage.includes('ECONNREFUSED')) {
      message = 'Connection refused - server may be down';
    } else if (errorMessage.includes('ENOTFOUND')) {
      message = 'Server not found - check URL';
    }

    return {
      serverId: server.id,
      status,
      message,
      responseTime,
      checkedAt: new Date().toISOString(),
    };
  }
}

/**
 * Check command-based server health by verifying the command exists.
 */
async function checkCommandHealth(server: CustomMcpServer, startTime: number): Promise<McpHealthCheckResult> {
  if (!server.command) {
    return {
      serverId: server.id,
      status: 'unhealthy',
      message: 'No command configured',
      checkedAt: new Date().toISOString(),
    };
  }

  return new Promise((resolve) => {
    // Defense-in-depth: Validate command and args before spawn
    if (!isCommandSafe(server.command)) {
      return resolve({
        serverId: server.id,
        status: 'unhealthy',
        message: `Invalid command '${server.command}' - not in allowlist`,
        checkedAt: new Date().toISOString(),
      });
    }
    if (!areArgsSafe(server.args)) {
      return resolve({
        serverId: server.id,
        status: 'unhealthy',
        message: 'Args contain dangerous flags or shell metacharacters',
        checkedAt: new Date().toISOString(),
      });
    }

    const command = process.platform === 'win32' ? 'where' : 'which';
    const proc = spawn(command, [server.command!], {
      timeout: 5000,
    });

    let found = false;

    proc.on('close', (code) => {
      const responseTime = Date.now() - startTime;

      if (code === 0 || found) {
        resolve({
          serverId: server.id,
          status: 'healthy',
          message: `Command '${server.command}' found`,
          responseTime,
          checkedAt: new Date().toISOString(),
        });
      } else {
        resolve({
          serverId: server.id,
          status: 'unhealthy',
          message: `Command '${server.command}' not found in PATH`,
          responseTime,
          checkedAt: new Date().toISOString(),
        });
      }
    });

    proc.stdout.on('data', () => {
      found = true;
    });

    proc.on('error', () => {
      const responseTime = Date.now() - startTime;
      resolve({
        serverId: server.id,
        status: 'unhealthy',
        message: `Failed to check command '${server.command}'`,
        responseTime,
        checkedAt: new Date().toISOString(),
      });
    });
  });
}

/**
 * Full MCP connection test - actually connects to the server and tries to list tools.
 * This is more thorough but slower than the health check.
 */
async function testMcpConnection(server: CustomMcpServer): Promise<McpTestConnectionResult> {
  const startTime = Date.now();

  if (server.type === 'http') {
    return testHttpConnection(server, startTime);
  } else {
    return testCommandConnection(server, startTime);
  }
}

/**
 * Test HTTP MCP server connection by sending an MCP initialize request.
 */
async function testHttpConnection(server: CustomMcpServer, startTime: number): Promise<McpTestConnectionResult> {
  if (!server.url) {
    return {
      serverId: server.id,
      success: false,
      message: 'No URL configured',
    };
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000); // 30 second timeout

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Accept': 'application/json, text/event-stream',
    };

    if (server.headers) {
      Object.assign(headers, server.headers);
    }

    appLog.info('[MCP Test] Testing connection to:', server.url);
    appLog.debug('[MCP Test] Headers:', JSON.stringify(redactSensitiveHeaders(headers)));

    // Send MCP initialize request
    const initRequest = createMcpInitRequest();

    const response = await fetch(server.url, {
      method: 'POST',
      headers,
      body: JSON.stringify(initRequest),
      signal: controller.signal,
    });

    clearTimeout(timeout);
    const responseTime = Date.now() - startTime;

    appLog.info('[MCP Test] Response status:', response.status, response.statusText);

    if (!response.ok) {
      // Try to get error body for more details
      let errorBody = '';
      try {
        errorBody = await response.text();
        appLog.debug('[MCP Test] Error response body:', errorBody.substring(0, 500));
      } catch (e) {
        appLog.debug('[MCP Test] Failed to get error response text:', e);
      }

      if (response.status === 401 || response.status === 403) {
        return {
          serverId: server.id,
          success: false,
          message: 'Authentication failed',
          error: `HTTP ${response.status}: ${response.statusText}${errorBody ? ` - ${errorBody.substring(0, 200)}` : ''}`,
          responseTime,
        };
      }
      return {
        serverId: server.id,
        success: false,
        message: `Server returned error`,
        error: `HTTP ${response.status}: ${response.statusText}${errorBody ? ` - ${errorBody.substring(0, 200)}` : ''}`,
        responseTime,
      };
    }

    // Check content type - SSE servers may return event stream
    const contentType = response.headers.get('content-type') || '';
    appLog.info('[MCP Test] Content-Type:', contentType);

    let data: McpJsonRpcResponse | undefined;
    // Use bounded read for SSE streams to avoid hanging on endless streams
    const responseText = await readResponseWithSSESupport(response, contentType);
    appLog.debug('[MCP Test] Response text (first 500):', responseText.substring(0, 500));

    // Determine if response is SSE format
    // Only treat as SSE if content-type explicitly indicates it, or response clearly looks like SSE
    const isSSE = contentType.includes('text/event-stream') ||
      responseText.startsWith('event:') ||
      (responseText.startsWith('data:') && contentType.includes('text/'));

    if (isSSE) {
      // Parse SSE format - extract JSON from data lines
      const dataLines = responseText.split('\n').filter(line => line.startsWith('data:'));
      if (dataLines.length > 0) {
        try {
          const jsonStr = dataLines[0].replace('data:', '').trim();
          data = JSON.parse(jsonStr) as McpJsonRpcResponse;
        } catch (e) {
          // SSE response but can't parse - log warning but consider it working
          appLog.warn('[MCP Test] SSE response received but could not parse JSON - verify server configuration', {
            serverId: server.id,
            responseTime,
            error: e instanceof Error ? e.message : 'Parse error'
          });
          return {
            serverId: server.id,
            success: false,
            message: 'Server reachable but MCP protocol could not be verified',
            error: 'SSE response could not be parsed as MCP JSON-RPC',
            responseTime,
          };
        }
      } else {
        // SSE response without data - server reachable but MCP not verified
        appLog.warn('[MCP Test] SSE response received without data lines - verify server configuration', {
          serverId: server.id,
          responseTime,
          contentType
        });
        return {
          serverId: server.id,
          success: false,
          message: 'Server reachable but MCP protocol could not be verified',
          error: 'SSE response did not contain expected data lines',
          responseTime,
        };
      }
    } else {
      // Standard JSON response
      try {
        data = JSON.parse(responseText) as McpJsonRpcResponse;
      } catch (parseError) {
        appLog.error('[MCP Test] Failed to parse response as JSON:', parseError);
        // Non-JSON 200 response - server reachable but MCP not verified
        appLog.warn('[MCP Test] Server responded with non-JSON format - may not be MCP compliant', {
          serverId: server.id,
          responseTime,
          contentType
        });
        return {
          serverId: server.id,
          success: false,
          message: 'Server reachable but MCP protocol could not be verified',
          error: 'Response was not valid JSON',
          responseTime,
        };
      }
    }

    appLog.debug('[MCP Test] Parsed data:', JSON.stringify(data).substring(0, 500));

    if (data?.error) {
      return {
        serverId: server.id,
        success: false,
        message: 'MCP error',
        error: data.error.message || JSON.stringify(data.error),
        responseTime,
      };
    }

    // If we got a valid initialize response, the server is working
    if (data?.result) {
      return {
        serverId: server.id,
        success: true,
        message: 'Connected successfully',
        responseTime,
      };
    }

    // Try to list tools as additional verification
    const toolsRequest = {
      jsonrpc: '2.0',
      id: 2,
      method: 'tools/list',
      params: {},
    };

    const toolsResponse = await fetch(server.url, {
      method: 'POST',
      headers,
      body: JSON.stringify(toolsRequest),
    });

    let tools: string[] = [];
    if (toolsResponse.ok) {
      const toolsData = await toolsResponse.json();
      if (toolsData.result?.tools) {
        tools = toolsData.result.tools.map((t: { name: string }) => t.name);
      }
    }

    return {
      serverId: server.id,
      success: true,
      message: tools.length > 0 ? `Connected successfully, ${tools.length} tools available` : 'Connected successfully',
      tools,
      responseTime,
    };
  } catch (error) {
    const responseTime = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    let message = 'Connection failed';
    if (errorMessage.includes('abort') || errorMessage.includes('timeout')) {
      message = 'Connection timed out';
    } else if (errorMessage.includes('ECONNREFUSED')) {
      message = 'Connection refused - server may be down';
    } else if (errorMessage.includes('ENOTFOUND')) {
      message = 'Server not found - check URL';
    }

    return {
      serverId: server.id,
      success: false,
      message,
      error: errorMessage,
      responseTime,
    };
  }
}

/**
 * Test command-based MCP server connection by spawning the process and trying to communicate.
 */
async function testCommandConnection(server: CustomMcpServer, startTime: number): Promise<McpTestConnectionResult> {
  if (!server.command) {
    return {
      serverId: server.id,
      success: false,
      message: 'No command configured',
    };
  }

  return new Promise((resolve) => {
    // Defense-in-depth: Validate command and args before spawn
    if (!isCommandSafe(server.command)) {
      return resolve({
        serverId: server.id,
        success: false,
        message: `Invalid command '${server.command}' - not in allowlist`,
      });
    }
    if (!areArgsSafe(server.args)) {
      return resolve({
        serverId: server.id,
        success: false,
        message: 'Args contain dangerous flags or shell metacharacters',
      });
    }

    const args = server.args || [];

    // On Windows, use shell: true to properly handle .cmd/.bat scripts like npx
    const proc = spawn(server.command!, args, {
      stdio: ['pipe', 'pipe', 'pipe'],
      timeout: 15000, // OS-level timeout for reliable process termination
      shell: process.platform === 'win32', // Required for Windows to run npx.cmd
    });

    let stdout = '';
    let stderr = '';
    let resolved = false;

    const timeoutId = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        proc.kill();
        const responseTime = Date.now() - startTime;
        resolve({
          serverId: server.id,
          success: false,
          message: 'Connection timed out',
          responseTime,
        });
      }
    }, 15000); // 15 second timeout (matches spawn timeout)

    // Send MCP initialize request (use shared factory for consistency)
    const initRequest = JSON.stringify(createMcpInitRequest()) + '\n';

    proc.stdin.write(initRequest);

    proc.stdout.on('data', (data) => {
      stdout += data.toString();

      // Try to parse JSON response
      try {
        const lines = stdout.split('\n').filter(l => l.trim());
        for (const line of lines) {
          const response = JSON.parse(line);
          if (response.id === 1 && response.result) {
            if (!resolved) {
              resolved = true;
              clearTimeout(timeoutId);
              proc.kill();
              const responseTime = Date.now() - startTime;
              resolve({
                serverId: server.id,
                success: true,
                message: 'MCP server started successfully',
                responseTime,
              });
            }
            return;
          }
        }
      } catch {
        // Not valid JSON yet, keep waiting
      }
    });

    proc.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    proc.on('error', (error) => {
      if (!resolved) {
        resolved = true;
        clearTimeout(timeoutId);
        const responseTime = Date.now() - startTime;
        resolve({
          serverId: server.id,
          success: false,
          message: 'Failed to start server',
          error: error.message,
          responseTime,
        });
      }
    });

    proc.on('close', (code) => {
      if (!resolved) {
        resolved = true;
        clearTimeout(timeoutId);
        const responseTime = Date.now() - startTime;
        if (code === 0) {
          resolve({
            serverId: server.id,
            success: true,
            message: 'Server process started',
            responseTime,
          });
        } else {
          resolve({
            serverId: server.id,
            success: false,
            message: `Server exited with code ${code}`,
            error: stderr || undefined,
            responseTime,
          });
        }
      }
    });
  });
}

/**
 * Register MCP IPC handlers.
 */
export function registerMcpHandlers(): void {
  // Quick health check
  ipcMain.handle(IPC_CHANNELS.MCP_CHECK_HEALTH, async (_event, server: CustomMcpServer) => {
    try {
      const result = await checkMcpHealth(server);
      return { success: true, data: result };
    } catch (error) {
      appLog.error('MCP health check error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Health check failed',
      };
    }
  });

  // Full connection test
  ipcMain.handle(IPC_CHANNELS.MCP_TEST_CONNECTION, async (_event, server: CustomMcpServer) => {
    try {
      const result = await testMcpConnection(server);
      return { success: true, data: result };
    } catch (error) {
      appLog.error('MCP connection test error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Connection test failed',
      };
    }
  });
}

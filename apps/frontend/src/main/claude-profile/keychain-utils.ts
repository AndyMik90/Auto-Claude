/**
 * macOS Keychain Utilities
 *
 * Provides functions to retrieve Claude Code OAuth tokens and email from macOS Keychain.
 * Supports both:
 * - Default profile: "Claude Code-credentials" service
 * - Custom profiles: "Claude Code-credentials-{sha256-8-hash}" where hash is first 8 chars
 *   of SHA256 hash of the CLAUDE_CONFIG_DIR path
 *
 * Mirrors the functionality of apps/backend/core/auth.py get_token_from_keychain()
 */

import { execFileSync } from 'child_process';
import { createHash } from 'crypto';
import { existsSync } from 'fs';
import { isMacOS } from '../platform';

/**
 * Credentials retrieved from macOS Keychain
 */
export interface KeychainCredentials {
  token: string | null;
  email: string | null;
  error?: string;  // Set when keychain access fails (locked, permission denied, etc.)
}

/**
 * Cache for keychain credentials to avoid repeated blocking calls
 * Map key is the service name (e.g., "Claude Code-credentials" or "Claude Code-credentials-d74c9506")
 */
interface KeychainCacheEntry {
  credentials: KeychainCredentials;
  timestamp: number;
}

const keychainCache = new Map<string, KeychainCacheEntry>();
// Cache for 5 minutes (300,000 ms) for successful results
const CACHE_TTL_MS = 5 * 60 * 1000;
// Cache for 10 seconds for error results (allows quick retry after keychain unlock)
const ERROR_CACHE_TTL_MS = 10 * 1000;

/**
 * Calculate the Keychain service name suffix for a config directory.
 * Claude Code uses SHA256 hash of the config dir path, taking first 8 hex chars.
 *
 * @param configDir - The CLAUDE_CONFIG_DIR path
 * @returns The 8-character hex hash suffix
 */
export function calculateConfigDirHash(configDir: string): string {
  return createHash('sha256').update(configDir).digest('hex').slice(0, 8);
}

/**
 * Get the Keychain service name for a config directory.
 *
 * @param configDir - Optional CLAUDE_CONFIG_DIR path. If not provided, returns default service name.
 * @returns The Keychain service name (e.g., "Claude Code-credentials-d74c9506")
 */
export function getKeychainServiceName(configDir?: string): string {
  if (!configDir) {
    return 'Claude Code-credentials';
  }
  const hash = calculateConfigDirHash(configDir);
  return `Claude Code-credentials-${hash}`;
}

/**
 * Validate the structure of parsed Keychain JSON data
 * @param data - Parsed JSON data from Keychain
 * @returns true if data structure is valid, false otherwise
 */
function validateKeychainData(data: unknown): data is { claudeAiOauth?: { accessToken?: string; email?: string }; email?: string } {
  if (!data || typeof data !== 'object') {
    return false;
  }

  const obj = data as Record<string, unknown>;

  // Check if claudeAiOauth exists and is an object
  if (obj.claudeAiOauth !== undefined) {
    if (typeof obj.claudeAiOauth !== 'object' || obj.claudeAiOauth === null) {
      return false;
    }
    const oauth = obj.claudeAiOauth as Record<string, unknown>;
    // Validate accessToken if present
    if (oauth.accessToken !== undefined && typeof oauth.accessToken !== 'string') {
      return false;
    }
    // Validate email if present
    if (oauth.email !== undefined && typeof oauth.email !== 'string') {
      return false;
    }
  }

  // Validate top-level email if present
  if (obj.email !== undefined && typeof obj.email !== 'string') {
    return false;
  }

  return true;
}

/**
 * Retrieve Claude Code OAuth credentials (token and email) from macOS Keychain.
 *
 * For default profile: reads from "Claude Code-credentials"
 * For custom profiles: reads from "Claude Code-credentials-{hash}" where hash is
 * SHA256(configDir).slice(0,8)
 *
 * Uses caching (5-minute TTL) to avoid repeated blocking calls.
 * Only works on macOS (Darwin platform).
 *
 * @param configDir - Optional CLAUDE_CONFIG_DIR path for custom profiles
 * @param forceRefresh - Set to true to bypass cache and fetch fresh credentials
 * @returns Object with token and email (both may be null if not found or invalid)
 */
export function getCredentialsFromKeychain(configDir?: string, forceRefresh = false): KeychainCredentials {
  // Only attempt on macOS
  if (!isMacOS()) {
    return { token: null, email: null };
  }

  const serviceName = getKeychainServiceName(configDir);

  // Return cached credentials if available and fresh
  const now = Date.now();
  const cached = keychainCache.get(serviceName);
  if (!forceRefresh && cached && (now - cached.timestamp) < CACHE_TTL_MS) {
    return cached.credentials;
  }

  // Locate the security executable using platform abstraction
  let securityPath: string | null = null;
  try {
    // The 'security' command is macOS-specific and typically in /usr/bin
    // Try common macOS locations instead of hardcoding
    const candidatePaths = ['/usr/bin/security', '/bin/security'];

    for (const candidate of candidatePaths) {
      if (existsSync(candidate)) {
        securityPath = candidate;
        break;
      }
    }

    if (!securityPath) {
      // Security command not found - this is expected on non-macOS or if security is missing
      const notFoundResult = { token: null, email: null, error: 'macOS security command not found' };
      keychainCache.set(serviceName, { credentials: notFoundResult, timestamp: now });
      return notFoundResult;
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.warn('[KeychainUtils] Failed to locate security executable:', errorMessage);
    const errorResult = { token: null, email: null, error: `Failed to locate security executable: ${errorMessage}` };
    keychainCache.set(serviceName, { credentials: errorResult, timestamp: now - (CACHE_TTL_MS - ERROR_CACHE_TTL_MS) });
    return errorResult;
  }

  try {
    // Query macOS Keychain for Claude Code credentials
    // Use execFileSync with argument array to prevent command injection
    const result = execFileSync(
      securityPath,
      ['find-generic-password', '-s', serviceName, '-w'],
      {
        encoding: 'utf-8',
        timeout: 5000,
        windowsHide: true,
      }
    );

    const credentialsJson = result.trim();
    if (!credentialsJson) {
      const emptyResult = { token: null, email: null };
      keychainCache.set(serviceName, { credentials: emptyResult, timestamp: now });
      return emptyResult;
    }

    // Parse JSON response
    let data: unknown;
    try {
      data = JSON.parse(credentialsJson);
    } catch {
      console.warn('[KeychainUtils] Failed to parse Keychain JSON for service:', serviceName);
      const errorResult = { token: null, email: null };
      keychainCache.set(serviceName, { credentials: errorResult, timestamp: now });
      return errorResult;
    }

    // Validate JSON structure
    if (!validateKeychainData(data)) {
      console.warn('[KeychainUtils] Invalid Keychain data structure for service:', serviceName);
      const invalidResult = { token: null, email: null };
      keychainCache.set(serviceName, { credentials: invalidResult, timestamp: now });
      return invalidResult;
    }

    // Extract OAuth token from nested structure
    const token = data?.claudeAiOauth?.accessToken;

    // Extract email (might be in different locations depending on Claude Code version)
    const email = data?.claudeAiOauth?.email || data?.email || null;

    // Validate token format if present
    // Use 'sk-ant-' prefix instead of 'sk-ant-oat01-' to support future token format versions
    // (e.g., oat02, oat03, etc.) without breaking validation
    if (token && !token.startsWith('sk-ant-')) {
      console.warn('[KeychainUtils] Invalid token format for service:', serviceName);
      const result = { token: null, email };
      keychainCache.set(serviceName, { credentials: result, timestamp: now });
      return result;
    }

    const credentials = { token: token || null, email };
    keychainCache.set(serviceName, { credentials, timestamp: now });
    console.debug('[KeychainUtils] Retrieved credentials from Keychain for service:', serviceName, { hasToken: !!token, hasEmail: !!email });
    return credentials;
  } catch (error) {
    // Check for exit code 44 (errSecItemNotFound) which indicates item not found
    if (error && typeof error === 'object' && 'status' in error && error.status === 44) {
      // Item not found - this is expected if user hasn't authenticated yet
      const notFoundResult = { token: null, email: null };
      keychainCache.set(serviceName, { credentials: notFoundResult, timestamp: now });
      return notFoundResult;
    }

    // Other errors (keychain locked, access denied, etc.) - return error details
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.warn('[KeychainUtils] Keychain access failed for service:', serviceName, errorMessage);
    const errorResult = { token: null, email: null, error: `Keychain access failed: ${errorMessage}` };
    // Use shorter TTL for errors so users who unlock keychain see quick recovery
    keychainCache.set(serviceName, { credentials: errorResult, timestamp: now - (CACHE_TTL_MS - ERROR_CACHE_TTL_MS) });
    return errorResult;
  }
}

/**
 * Clear the keychain credentials cache for a specific service or all services.
 * Useful when you know the credentials have changed (e.g., after running claude /login)
 *
 * @param configDir - Optional config dir to clear cache for specific profile. If not provided, clears all.
 */
export function clearKeychainCache(configDir?: string): void {
  if (configDir) {
    const serviceName = getKeychainServiceName(configDir);
    keychainCache.delete(serviceName);
  } else {
    keychainCache.clear();
  }
}

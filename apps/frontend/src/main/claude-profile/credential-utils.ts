/**
 * Cross-Platform Credential Utilities
 *
 * Provides functions to retrieve Claude Code OAuth tokens and email from
 * platform-specific secure storage:
 * - macOS: Keychain (via `security` command)
 * - Linux: .credentials.json file in config directory
 * - Windows: Windows Credential Manager (via PowerShell)
 *
 * Supports both:
 * - Default profile: "Claude Code-credentials" service / default config dir
 * - Custom profiles: "Claude Code-credentials-{sha256-8-hash}" where hash is first 8 chars
 *   of SHA256 hash of the CLAUDE_CONFIG_DIR path
 *
 * Mirrors the functionality of apps/backend/core/auth.py get_token_from_keychain()
 */

import { execFileSync } from 'child_process';
import { createHash } from 'crypto';
import { existsSync, readFileSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';
import { isMacOS, isWindows, isLinux } from '../platform';

/**
 * Create a safe fingerprint of a token for debug logging.
 * Shows first 8 and last 4 characters, hiding the sensitive middle portion.
 * This is NOT for authentication - only for human-readable debug identification.
 *
 * @param token - The token to create a fingerprint for
 * @returns A safe fingerprint like "sk-ant-oa...xyz9" or "null" if no token
 */
function getTokenFingerprint(token: string | null | undefined): string {
  if (!token) return 'null';
  if (token.length <= 16) return token.slice(0, 4) + '...' + token.slice(-2);
  return token.slice(0, 8) + '...' + token.slice(-4);
}

/**
 * Credentials retrieved from platform-specific secure storage
 */
export interface PlatformCredentials {
  token: string | null;
  email: string | null;
  error?: string;  // Set when credential access fails (locked, permission denied, etc.)
}

// Legacy alias for backwards compatibility
export type KeychainCredentials = PlatformCredentials;

/**
 * Cache for credentials to avoid repeated blocking calls
 * Map key is the cache key (e.g., "macos:Claude Code-credentials" or "linux:/home/user/.claude")
 */
interface CredentialCacheEntry {
  credentials: PlatformCredentials;
  timestamp: number;
}

const credentialCache = new Map<string, CredentialCacheEntry>();
// Cache for 5 minutes (300,000 ms) for successful results
const CACHE_TTL_MS = 5 * 60 * 1000;
// Cache for 10 seconds for error results (allows quick retry after unlock)
const ERROR_CACHE_TTL_MS = 10 * 1000;

// Timeouts for credential retrieval operations
const MACOS_KEYCHAIN_TIMEOUT_MS = 5000;
const WINDOWS_CREDMAN_TIMEOUT_MS = 10000;

// Defense-in-depth: Pattern for valid credential target names
// Matches "Claude Code-credentials" or "Claude Code-credentials-{8 hex chars}"
const VALID_TARGET_NAME_PATTERN = /^Claude Code-credentials(-[a-f0-9]{8})?$/;

/**
 * Validate that a credential target name matches the expected format.
 * Defense-in-depth check to prevent injection attacks.
 *
 * @param targetName - The target name to validate
 * @returns true if valid, false otherwise
 */
function isValidTargetName(targetName: string): boolean {
  return VALID_TARGET_NAME_PATTERN.test(targetName);
}

/**
 * Validate that a credentials path is within expected boundaries.
 * Defense-in-depth check to prevent path traversal attacks.
 *
 * @param credentialsPath - The path to validate
 * @returns true if valid, false otherwise
 */
function isValidCredentialsPath(credentialsPath: string): boolean {
  // Credentials path should:
  // 1. Not contain path traversal sequences (works on both Unix and Windows)
  // 2. End with the expected file name
  // Note: We allow custom config directories since they come from user settings
  // The configDir is from profile settings, which is trusted user input
  return (
    !credentialsPath.includes('..') &&
    credentialsPath.endsWith('.credentials.json')
  );
}

/**
 * Calculate the credential storage identifier suffix for a config directory.
 * Claude Code uses SHA256 hash of the config dir path, taking first 8 hex chars.
 *
 * @param configDir - The CLAUDE_CONFIG_DIR path
 * @returns The 8-character hex hash suffix
 */
export function calculateConfigDirHash(configDir: string): string {
  return createHash('sha256').update(configDir).digest('hex').slice(0, 8);
}

/**
 * Get the Keychain service name for a config directory (macOS).
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
 * Get the Windows Credential Manager target name for a config directory.
 *
 * @param configDir - Optional CLAUDE_CONFIG_DIR path. If not provided, returns default target name.
 * @returns The Credential Manager target name (e.g., "Claude Code-credentials-d74c9506")
 */
export function getWindowsCredentialTarget(configDir?: string): string {
  // Windows uses the same naming convention as macOS Keychain
  return getKeychainServiceName(configDir);
}

/**
 * Validate the structure of parsed credential JSON data
 * @param data - Parsed JSON data from credential store
 * @returns true if data structure is valid, false otherwise
 */
function validateCredentialData(data: unknown): data is { claudeAiOauth?: { accessToken?: string; email?: string; emailAddress?: string }; email?: string } {
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
    // Validate email if present (can be 'email' or 'emailAddress')
    if (oauth.email !== undefined && typeof oauth.email !== 'string') {
      return false;
    }
    if (oauth.emailAddress !== undefined && typeof oauth.emailAddress !== 'string') {
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
 * Extract token and email from validated credential data
 */
function extractCredentials(data: { claudeAiOauth?: { accessToken?: string; email?: string; emailAddress?: string }; email?: string }): { token: string | null; email: string | null } {
  // Extract OAuth token from nested structure
  const token = data?.claudeAiOauth?.accessToken || null;

  // Extract email (might be in different locations depending on Claude Code version)
  const email = data?.claudeAiOauth?.email || data?.claudeAiOauth?.emailAddress || data?.email || null;

  return { token, email };
}

/**
 * Validate token format
 * Use 'sk-ant-' prefix to support future token format versions (oat02, oat03, etc.)
 */
function isValidTokenFormat(token: string): boolean {
  return token.startsWith('sk-ant-');
}

// =============================================================================
// macOS Keychain Implementation
// =============================================================================

/**
 * Retrieve credentials from macOS Keychain
 */
function getCredentialsFromMacOSKeychain(configDir?: string, forceRefresh = false): PlatformCredentials {
  const serviceName = getKeychainServiceName(configDir);
  const cacheKey = `macos:${serviceName}`;
  const isDebug = process.env.DEBUG === 'true';
  const now = Date.now();

  // Return cached credentials if available and fresh
  const cached = credentialCache.get(cacheKey);
  if (!forceRefresh && cached) {
    const ttl = cached.credentials.error ? ERROR_CACHE_TTL_MS : CACHE_TTL_MS;
    if ((now - cached.timestamp) < ttl) {
      if (isDebug) {
        const cacheAge = now - cached.timestamp;
        console.warn('[CredentialUtils:macOS:CACHE] Returning cached credentials:', {
          serviceName,
          hasToken: !!cached.credentials.token,
          tokenFingerprint: getTokenFingerprint(cached.credentials.token),
          cacheAge: Math.round(cacheAge / 1000) + 's'
        });
      }
      return cached.credentials;
    }
  }

  // Locate the security executable
  let securityPath: string | null = null;
  const candidatePaths = ['/usr/bin/security', '/bin/security'];

  for (const candidate of candidatePaths) {
    if (existsSync(candidate)) {
      securityPath = candidate;
      break;
    }
  }

  if (!securityPath) {
    const notFoundResult = { token: null, email: null, error: 'macOS security command not found' };
    credentialCache.set(cacheKey, { credentials: notFoundResult, timestamp: now });
    return notFoundResult;
  }

  try {
    // Query macOS Keychain for Claude Code credentials
    const result = execFileSync(
      securityPath,
      ['find-generic-password', '-s', serviceName, '-w'],
      {
        encoding: 'utf-8',
        timeout: MACOS_KEYCHAIN_TIMEOUT_MS,
        windowsHide: true,
      }
    );

    const credentialsJson = result.trim();
    if (!credentialsJson) {
      const emptyResult = { token: null, email: null };
      credentialCache.set(cacheKey, { credentials: emptyResult, timestamp: now });
      return emptyResult;
    }

    // Parse JSON response
    let data: unknown;
    try {
      data = JSON.parse(credentialsJson);
    } catch {
      console.warn('[CredentialUtils:macOS] Failed to parse Keychain JSON for service:', serviceName);
      const errorResult = { token: null, email: null };
      credentialCache.set(cacheKey, { credentials: errorResult, timestamp: now });
      return errorResult;
    }

    // Validate JSON structure
    if (!validateCredentialData(data)) {
      console.warn('[CredentialUtils:macOS] Invalid Keychain data structure for service:', serviceName);
      const invalidResult = { token: null, email: null };
      credentialCache.set(cacheKey, { credentials: invalidResult, timestamp: now });
      return invalidResult;
    }

    const { token, email } = extractCredentials(data);

    // Validate token format if present
    if (token && !isValidTokenFormat(token)) {
      console.warn('[CredentialUtils:macOS] Invalid token format for service:', serviceName);
      const result = { token: null, email };
      credentialCache.set(cacheKey, { credentials: result, timestamp: now });
      return result;
    }

    const credentials = { token, email };
    credentialCache.set(cacheKey, { credentials, timestamp: now });

    if (isDebug) {
      console.warn('[CredentialUtils:macOS] Retrieved credentials from Keychain for service:', serviceName, {
        hasToken: !!token,
        hasEmail: !!email,
        tokenFingerprint: getTokenFingerprint(token),
        forceRefresh
      });
    }
    return credentials;
  } catch (error) {
    // Check for exit code 44 (errSecItemNotFound) which indicates item not found
    if (error && typeof error === 'object' && 'status' in error && error.status === 44) {
      const notFoundResult = { token: null, email: null };
      credentialCache.set(cacheKey, { credentials: notFoundResult, timestamp: now });
      return notFoundResult;
    }

    const errorMessage = error instanceof Error ? error.message : String(error);
    console.warn('[CredentialUtils:macOS] Keychain access failed for service:', serviceName, errorMessage);
    const errorResult = { token: null, email: null, error: `Keychain access failed: ${errorMessage}` };
    // Use shorter TTL for errors
    credentialCache.set(cacheKey, { credentials: errorResult, timestamp: now });
    return errorResult;
  }
}

// =============================================================================
// Linux Credentials File Implementation
// =============================================================================

/**
 * Get the credentials file path for Linux
 */
function getLinuxCredentialsPath(configDir?: string): string {
  const baseDir = configDir || join(homedir(), '.claude');
  return join(baseDir, '.credentials.json');
}

/**
 * Retrieve credentials from Linux .credentials.json file
 */
function getCredentialsFromLinuxFile(configDir?: string, forceRefresh = false): PlatformCredentials {
  const credentialsPath = getLinuxCredentialsPath(configDir);
  const cacheKey = `linux:${credentialsPath}`;
  const isDebug = process.env.DEBUG === 'true';
  const now = Date.now();

  // Return cached credentials if available and fresh
  const cached = credentialCache.get(cacheKey);
  if (!forceRefresh && cached) {
    const ttl = cached.credentials.error ? ERROR_CACHE_TTL_MS : CACHE_TTL_MS;
    if ((now - cached.timestamp) < ttl) {
      if (isDebug) {
        const cacheAge = now - cached.timestamp;
        console.warn('[CredentialUtils:Linux:CACHE] Returning cached credentials:', {
          credentialsPath,
          hasToken: !!cached.credentials.token,
          tokenFingerprint: getTokenFingerprint(cached.credentials.token),
          cacheAge: Math.round(cacheAge / 1000) + 's'
        });
      }
      return cached.credentials;
    }
  }

  // Defense-in-depth: Validate credentials path is within expected boundaries
  if (!isValidCredentialsPath(credentialsPath)) {
    if (isDebug) {
      console.warn('[CredentialUtils:Linux] Invalid credentials path rejected:', { credentialsPath });
    }
    const invalidResult = { token: null, email: null, error: 'Invalid credentials path' };
    credentialCache.set(cacheKey, { credentials: invalidResult, timestamp: now });
    return invalidResult;
  }

  // Check if credentials file exists
  if (!existsSync(credentialsPath)) {
    if (isDebug) {
      console.warn('[CredentialUtils:Linux] Credentials file not found:', credentialsPath);
    }
    const notFoundResult = { token: null, email: null };
    credentialCache.set(cacheKey, { credentials: notFoundResult, timestamp: now });
    return notFoundResult;
  }

  try {
    const content = readFileSync(credentialsPath, 'utf-8');

    // Parse JSON
    let data: unknown;
    try {
      data = JSON.parse(content);
    } catch {
      console.warn('[CredentialUtils:Linux] Failed to parse credentials JSON:', credentialsPath);
      const errorResult = { token: null, email: null };
      credentialCache.set(cacheKey, { credentials: errorResult, timestamp: now });
      return errorResult;
    }

    // Validate JSON structure
    if (!validateCredentialData(data)) {
      console.warn('[CredentialUtils:Linux] Invalid credentials data structure:', credentialsPath);
      const invalidResult = { token: null, email: null };
      credentialCache.set(cacheKey, { credentials: invalidResult, timestamp: now });
      return invalidResult;
    }

    const { token, email } = extractCredentials(data);

    // Validate token format if present
    if (token && !isValidTokenFormat(token)) {
      console.warn('[CredentialUtils:Linux] Invalid token format in:', credentialsPath);
      const result = { token: null, email };
      credentialCache.set(cacheKey, { credentials: result, timestamp: now });
      return result;
    }

    const credentials = { token, email };
    credentialCache.set(cacheKey, { credentials, timestamp: now });

    if (isDebug) {
      console.warn('[CredentialUtils:Linux] Retrieved credentials from file:', credentialsPath, {
        hasToken: !!token,
        hasEmail: !!email,
        tokenFingerprint: getTokenFingerprint(token),
        forceRefresh
      });
    }
    return credentials;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.warn('[CredentialUtils:Linux] Failed to read credentials file:', credentialsPath, errorMessage);
    const errorResult = { token: null, email: null, error: `Failed to read credentials: ${errorMessage}` };
    credentialCache.set(cacheKey, { credentials: errorResult, timestamp: now });
    return errorResult;
  }
}

// =============================================================================
// Windows Credential Manager Implementation
// =============================================================================

/**
 * Retrieve credentials from Windows Credential Manager using PowerShell
 *
 * Windows Credential Manager stores credentials with:
 * - Target Name: "Claude Code-credentials" or "Claude Code-credentials-{hash}"
 * - Type: Generic credential
 * - Password field contains JSON with { claudeAiOauth: { accessToken, email } }
 */
function getCredentialsFromWindowsCredentialManager(configDir?: string, forceRefresh = false): PlatformCredentials {
  const targetName = getWindowsCredentialTarget(configDir);
  const cacheKey = `windows:${targetName}`;
  const isDebug = process.env.DEBUG === 'true';
  const now = Date.now();

  // Return cached credentials if available and fresh
  const cached = credentialCache.get(cacheKey);
  if (!forceRefresh && cached) {
    const ttl = cached.credentials.error ? ERROR_CACHE_TTL_MS : CACHE_TTL_MS;
    if ((now - cached.timestamp) < ttl) {
      if (isDebug) {
        const cacheAge = now - cached.timestamp;
        console.warn('[CredentialUtils:Windows:CACHE] Returning cached credentials:', {
          targetName,
          hasToken: !!cached.credentials.token,
          tokenFingerprint: getTokenFingerprint(cached.credentials.token),
          cacheAge: Math.round(cacheAge / 1000) + 's'
        });
      }
      return cached.credentials;
    }
  }

  // Defense-in-depth: Validate target name format before using in PowerShell
  if (!isValidTargetName(targetName)) {
    const invalidResult = { token: null, email: null, error: 'Invalid credential target name format' };
    credentialCache.set(cacheKey, { credentials: invalidResult, timestamp: now });
    if (isDebug) {
      console.warn('[CredentialUtils:Windows] Invalid target name rejected:', { targetName });
    }
    return invalidResult;
  }

  // Find PowerShell executable
  const psPath = findPowerShellPath();
  if (!psPath) {
    const notFoundResult = { token: null, email: null, error: 'PowerShell not found' };
    credentialCache.set(cacheKey, { credentials: notFoundResult, timestamp: now });
    return notFoundResult;
  }

  try {
    // PowerShell script to read from Credential Manager
    // Uses the Windows Credential Manager API via .NET
    const psScript = `
      $ErrorActionPreference = 'Stop'
      Add-Type -AssemblyName System.Runtime.WindowsRuntime

      # Use CredRead from advapi32.dll to read generic credentials
      $sig = @'
      [DllImport("advapi32.dll", SetLastError = true, CharSet = CharSet.Unicode)]
      public static extern bool CredRead(string target, int type, int reservedFlag, out IntPtr credentialPtr);

      [DllImport("advapi32.dll", SetLastError = true)]
      public static extern bool CredFree(IntPtr cred);
'@
      Add-Type -MemberDefinition $sig -Namespace Win32 -Name Credential

      $credPtr = [IntPtr]::Zero
      # CRED_TYPE_GENERIC = 1
      $success = [Win32.Credential]::CredRead("${targetName.replace(/"/g, '`"')}", 1, 0, [ref]$credPtr)

      if ($success) {
        try {
          $cred = [Runtime.InteropServices.Marshal]::PtrToStructure($credPtr, [Type][System.Management.Automation.PSCredential].Assembly.GetType('Microsoft.PowerShell.Commands.CREDENTIAL'))

          # Read the credential blob (password field)
          $blobSize = $cred.CredentialBlobSize
          if ($blobSize -gt 0) {
            $blob = [byte[]]::new($blobSize)
            [Runtime.InteropServices.Marshal]::Copy($cred.CredentialBlob, $blob, 0, $blobSize)
            $password = [System.Text.Encoding]::Unicode.GetString($blob)
            Write-Output $password
          }
        } finally {
          [Win32.Credential]::CredFree($credPtr) | Out-Null
        }
      } else {
        # Credential not found - this is expected if user hasn't authenticated
        Write-Output ""
      }
    `;

    const result = execFileSync(
      psPath,
      ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', psScript],
      {
        encoding: 'utf-8',
        timeout: WINDOWS_CREDMAN_TIMEOUT_MS,
        windowsHide: true,
      }
    );

    const credentialsJson = result.trim();
    if (!credentialsJson) {
      if (isDebug) {
        console.warn('[CredentialUtils:Windows] Credential not found for target:', targetName);
      }
      const notFoundResult = { token: null, email: null };
      credentialCache.set(cacheKey, { credentials: notFoundResult, timestamp: now });
      return notFoundResult;
    }

    // Parse JSON response
    let data: unknown;
    try {
      data = JSON.parse(credentialsJson);
    } catch {
      console.warn('[CredentialUtils:Windows] Failed to parse credential JSON for target:', targetName);
      const errorResult = { token: null, email: null };
      credentialCache.set(cacheKey, { credentials: errorResult, timestamp: now });
      return errorResult;
    }

    // Validate JSON structure
    if (!validateCredentialData(data)) {
      console.warn('[CredentialUtils:Windows] Invalid credential data structure for target:', targetName);
      const invalidResult = { token: null, email: null };
      credentialCache.set(cacheKey, { credentials: invalidResult, timestamp: now });
      return invalidResult;
    }

    const { token, email } = extractCredentials(data);

    // Validate token format if present
    if (token && !isValidTokenFormat(token)) {
      console.warn('[CredentialUtils:Windows] Invalid token format for target:', targetName);
      const result = { token: null, email };
      credentialCache.set(cacheKey, { credentials: result, timestamp: now });
      return result;
    }

    const credentials = { token, email };
    credentialCache.set(cacheKey, { credentials, timestamp: now });

    if (isDebug) {
      console.warn('[CredentialUtils:Windows] Retrieved credentials from Credential Manager for target:', targetName, {
        hasToken: !!token,
        hasEmail: !!email,
        tokenFingerprint: getTokenFingerprint(token),
        forceRefresh
      });
    }
    return credentials;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.warn('[CredentialUtils:Windows] Credential Manager access failed for target:', targetName, errorMessage);
    const errorResult = { token: null, email: null, error: `Credential Manager access failed: ${errorMessage}` };
    credentialCache.set(cacheKey, { credentials: errorResult, timestamp: now });
    return errorResult;
  }
}

/**
 * Find PowerShell executable path on Windows
 */
function findPowerShellPath(): string | null {
  // Prefer PowerShell 7+ (pwsh) over Windows PowerShell
  const candidatePaths = [
    join(process.env.ProgramFiles || 'C:\\Program Files', 'PowerShell', '7', 'pwsh.exe'),
    join(homedir(), 'AppData', 'Local', 'Microsoft', 'WindowsApps', 'pwsh.exe'),
    join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe'),
  ];

  for (const candidate of candidatePaths) {
    if (existsSync(candidate)) {
      return candidate;
    }
  }

  return null;
}

// =============================================================================
// Cross-Platform Public API
// =============================================================================

/**
 * Retrieve Claude Code OAuth credentials (token and email) from platform-specific
 * secure storage.
 *
 * - macOS: Reads from Keychain
 * - Linux: Reads from .credentials.json file
 * - Windows: Reads from Windows Credential Manager
 *
 * For default profile: reads from "Claude Code-credentials" or default config dir
 * For custom profiles: uses SHA256(configDir).slice(0,8) hash suffix
 *
 * Uses caching (5-minute TTL) to avoid repeated blocking calls.
 *
 * @param configDir - Optional CLAUDE_CONFIG_DIR path for custom profiles
 * @param forceRefresh - Set to true to bypass cache and fetch fresh credentials
 * @returns Object with token and email (both may be null if not found or invalid)
 */
export function getCredentialsFromKeychain(configDir?: string, forceRefresh = false): PlatformCredentials {
  if (isMacOS()) {
    return getCredentialsFromMacOSKeychain(configDir, forceRefresh);
  }

  if (isLinux()) {
    return getCredentialsFromLinuxFile(configDir, forceRefresh);
  }

  if (isWindows()) {
    return getCredentialsFromWindowsCredentialManager(configDir, forceRefresh);
  }

  // Unknown platform - return empty
  return { token: null, email: null, error: `Unsupported platform: ${process.platform}` };
}

/**
 * Alias for getCredentialsFromKeychain for semantic clarity on non-macOS platforms
 */
export const getCredentials = getCredentialsFromKeychain;

/**
 * Clear the credentials cache for a specific profile or all profiles.
 * Useful when you know the credentials have changed (e.g., after running claude /login)
 *
 * @param configDir - Optional config dir to clear cache for specific profile. If not provided, clears all.
 */
export function clearKeychainCache(configDir?: string): void {
  if (configDir) {
    // Clear cache for this specific configDir on all platforms
    const macOSKey = `macos:${getKeychainServiceName(configDir)}`;
    const linuxKey = `linux:${getLinuxCredentialsPath(configDir)}`;
    const windowsKey = `windows:${getWindowsCredentialTarget(configDir)}`;

    credentialCache.delete(macOSKey);
    credentialCache.delete(linuxKey);
    credentialCache.delete(windowsKey);
  } else {
    credentialCache.clear();
  }
}

/**
 * Alias for clearKeychainCache for semantic clarity
 */
export const clearCredentialCache = clearKeychainCache;

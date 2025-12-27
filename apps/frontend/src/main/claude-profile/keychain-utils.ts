/**
 * macOS Keychain Utilities
 *
 * Provides functions to retrieve Claude Code OAuth tokens from macOS Keychain.
 * Mirrors the functionality of apps/backend/core/auth.py get_token_from_keychain()
 */

import { execSync } from 'child_process';

/**
 * Retrieve Claude Code OAuth token from macOS Keychain.
 *
 * Reads from the "Claude Code-credentials" service in macOS Keychain
 * and extracts the OAuth access token.
 *
 * Only works on macOS (Darwin platform).
 *
 * @returns Token string if found and valid, null otherwise
 */
export function getTokenFromKeychain(): string | null {
  // Only attempt on macOS
  if (process.platform !== 'darwin') {
    return null;
  }

  try {
    // Query macOS Keychain for Claude Code credentials
    const result = execSync(
      '/usr/bin/security find-generic-password -s "Claude Code-credentials" -w',
      {
        encoding: 'utf-8',
        timeout: 5000,
        windowsHide: true,
      }
    );

    const credentialsJson = result.trim();
    if (!credentialsJson) {
      return null;
    }

    // Parse JSON response
    const data = JSON.parse(credentialsJson);

    // Extract OAuth token from nested structure
    const token = data?.claudeAiOauth?.accessToken;

    if (!token) {
      return null;
    }

    // Validate token format (Claude OAuth tokens start with sk-ant-oat01-)
    if (!token.startsWith('sk-ant-oat01-')) {
      console.warn('[KeychainUtils] Token found but invalid format');
      return null;
    }

    return token;
  } catch (error) {
    // Silently fail - this is a fallback mechanism
    // Common reasons for failure:
    // - Keychain not unlocked
    // - No credentials stored
    // - User denied access
    if (error instanceof Error && error.message.includes('could not be found')) {
      // Item not found - this is expected if user hasn't run claude setup-token
      return null;
    }

    console.warn('[KeychainUtils] Failed to retrieve token from Keychain:', error instanceof Error ? error.message : 'Unknown error');
    return null;
  }
}

/**
 * Extract email from Keychain credentials if available.
 *
 * @returns Email string if found, null otherwise
 */
export function getEmailFromKeychain(): string | null {
  if (process.platform !== 'darwin') {
    return null;
  }

  try {
    const result = execSync(
      '/usr/bin/security find-generic-password -s "Claude Code-credentials" -w',
      {
        encoding: 'utf-8',
        timeout: 5000,
        windowsHide: true,
      }
    );

    const credentialsJson = result.trim();
    if (!credentialsJson) {
      return null;
    }

    const data = JSON.parse(credentialsJson);

    // Email might be in different locations depending on Claude Code version
    return data?.claudeAiOauth?.email || data?.email || null;
  } catch (error) {
    return null;
  }
}

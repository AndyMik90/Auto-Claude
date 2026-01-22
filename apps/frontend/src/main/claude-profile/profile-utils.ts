/**
 * Profile Utilities Module
 * Helper functions for profile operations
 */

import { homedir } from 'os';
import { join } from 'path';
import { existsSync, readFileSync, readdirSync, mkdirSync } from 'fs';
import type { ClaudeProfile } from '../../shared/types';

/**
 * Default Claude config directory
 */
export const DEFAULT_CLAUDE_CONFIG_DIR = join(homedir(), '.claude');

/**
 * Default profiles directory for additional accounts
 */
export const CLAUDE_PROFILES_DIR = join(homedir(), '.claude-profiles');

/**
 * Generate a unique ID for a new profile
 */
export function generateProfileId(name: string, existingProfiles: ClaudeProfile[]): string {
  const baseId = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  let id = baseId;
  let counter = 1;

  while (existingProfiles.some(p => p.id === id)) {
    id = `${baseId}-${counter}`;
    counter++;
  }

  return id;
}

/**
 * Create a new profile directory and initialize it
 */
export async function createProfileDirectory(profileName: string): Promise<string> {
  // Ensure profiles directory exists
  if (!existsSync(CLAUDE_PROFILES_DIR)) {
    mkdirSync(CLAUDE_PROFILES_DIR, { recursive: true });
  }

  // Create directory for this profile
  const sanitizedName = profileName.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  const profileDir = join(CLAUDE_PROFILES_DIR, sanitizedName);

  if (!existsSync(profileDir)) {
    mkdirSync(profileDir, { recursive: true });
  }

  return profileDir;
}

/**
 * Check if a profile has valid authentication
 * (checks for OAuth token or config directory credential files)
 */
export function isProfileAuthenticated(profile: ClaudeProfile): boolean {
  // Check for direct OAuth token first (OAuth-only profiles without configDir)
  // This enables auto-switch to work with profiles that only have oauthToken set
  if (hasValidToken(profile)) {
    return true;
  }

  // Check for configDir-based credentials (legacy or CLI-authenticated profiles)
  const configDir = profile.configDir;
  if (!configDir || !existsSync(configDir)) {
    return false;
  }

  // Check for .claude.json with OAuth account info (modern Claude Code CLI)
  // This is how Claude Code CLI stores OAuth authentication since v1.0
  const claudeJsonPath = join(configDir, '.claude.json');
  if (existsSync(claudeJsonPath)) {
    try {
      const content = readFileSync(claudeJsonPath, 'utf-8');
      const data = JSON.parse(content);
      // Check for oauthAccount which indicates successful OAuth authentication
      if (data && typeof data === 'object' && (data.oauthAccount?.accountUuid || data.oauthAccount?.emailAddress)) {
        return true;
      }
    } catch (error) {
      // Log parse errors for debugging, but fall through to legacy checks
      console.warn(`[profile-utils] Failed to read or parse ${claudeJsonPath}:`, error);
    }
  }

  // Legacy: Claude stores auth in .claude/credentials or similar files
  // Check for common auth indicators
  const possibleAuthFiles = [
    join(configDir, 'credentials'),
    join(configDir, 'credentials.json'),
    join(configDir, '.credentials'),
    join(configDir, 'settings.json'),  // Often contains auth tokens
  ];

  for (const authFile of possibleAuthFiles) {
    if (existsSync(authFile)) {
      try {
        const content = readFileSync(authFile, 'utf-8');
        // Check if file has actual content (not just empty or placeholder)
        if (content.length > 10) {
          return true;
        }
      } catch {
        // Ignore read errors
      }
    }
  }

  // Also check if there are any session files (indicates authenticated usage)
  const projectsDir = join(configDir, 'projects');
  if (existsSync(projectsDir)) {
    try {
      const projects = readdirSync(projectsDir);
      if (projects.length > 0) {
        return true;
      }
    } catch {
      // Ignore read errors
    }
  }

  return false;
}

/**
 * Check if a profile has a valid OAuth token.
 * Token is valid for 1 year from creation.
 */
export function hasValidToken(profile: ClaudeProfile): boolean {
  if (!profile?.oauthToken) {
    return false;
  }

  // Check if token is expired (1 year validity)
  if (profile.tokenCreatedAt) {
    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
    if (new Date(profile.tokenCreatedAt) < oneYearAgo) {
      return false;
    }
  }

  return true;
}

/**
 * Expand ~ in path to home directory
 */
export function expandHomePath(path: string): string {
  if (path && path.startsWith('~')) {
    const home = homedir();
    return path.replace(/^~/, home);
  }
  return path;
}

/**
 * Result of reading OAuth token from system credentials
 */
export interface SystemCredentialsResult {
  accessToken?: string;
  refreshToken?: string;
  expiresAt?: number;  // Unix timestamp in milliseconds
  email?: string;
}

/**
 * Read OAuth token from system credentials file.
 * Checks .claude.json (macOS/Windows) and .credentials.json (Linux).
 *
 * @param configDir - The config directory to check (defaults to ~/.claude)
 * @returns The OAuth credentials if found, or undefined
 */
export function getTokenFromSystemCredentials(configDir?: string): SystemCredentialsResult | undefined {
  const dir = configDir ? expandHomePath(configDir) : DEFAULT_CLAUDE_CONFIG_DIR;

  // Check .claude.json first (modern format, used on macOS/Windows)
  const claudeJsonPath = join(dir, '.claude.json');
  if (existsSync(claudeJsonPath)) {
    try {
      const content = readFileSync(claudeJsonPath, 'utf-8');
      const data = JSON.parse(content);
      if (data?.oauthAccount?.accessToken) {
        return {
          accessToken: data.oauthAccount.accessToken,
          refreshToken: data.oauthAccount.refreshToken,
          expiresAt: data.oauthAccount.expiresAt,
          email: data.oauthAccount.emailAddress
        };
      }
    } catch (error) {
      console.warn('[profile-utils] Failed to read .claude.json:', error);
    }
  }

  // Check .credentials.json (Linux format)
  const credentialsJsonPath = join(dir, '.credentials.json');
  if (existsSync(credentialsJsonPath)) {
    try {
      const content = readFileSync(credentialsJsonPath, 'utf-8');
      const data = JSON.parse(content);

      // Format: { claudeAiOauth: { accessToken, refreshToken, expiresAt, ... } }
      if (data?.claudeAiOauth?.accessToken) {
        return {
          accessToken: data.claudeAiOauth.accessToken,
          refreshToken: data.claudeAiOauth.refreshToken,
          expiresAt: data.claudeAiOauth.expiresAt,
          email: data.claudeAiOauth.email || data.claudeAiOauth.emailAddress
        };
      }

      // Alternative format: { oauthAccount: { ... } }
      if (data?.oauthAccount?.accessToken) {
        return {
          accessToken: data.oauthAccount.accessToken,
          refreshToken: data.oauthAccount.refreshToken,
          expiresAt: data.oauthAccount.expiresAt,
          email: data.oauthAccount.emailAddress
        };
      }
    } catch (error) {
      console.warn('[profile-utils] Failed to read .credentials.json:', error);
    }
  }

  return undefined;
}

/**
 * Check if a token from system credentials is expired.
 *
 * @param expiresAt - The expiration timestamp in milliseconds
 * @returns true if the token is expired or will expire in the next 5 minutes.
 *          Returns false if no expiration is provided (backward compatibility
 *          for tokens without expiration tracking, e.g., legacy or manually-set tokens).
 */
export function isTokenExpired(expiresAt?: number): boolean {
  if (!expiresAt) {
    // No expiration timestamp means either:
    // 1. Legacy token without expiration tracking
    // 2. Manually-set token without server-provided expiration
    // Assume valid to maintain backward compatibility
    return false;
  }

  // Add 5 minute buffer to avoid edge cases
  const bufferMs = 5 * 60 * 1000;
  return Date.now() + bufferMs >= expiresAt;
}

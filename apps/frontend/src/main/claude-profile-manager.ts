/**
 * Claude Profile Manager
 * Main coordinator for multi-account profile management
 *
 * This class delegates to specialized modules:
 * - token-encryption: OAuth token encryption/decryption
 * - usage-parser: Usage data parsing and reset time calculations
 * - rate-limit-manager: Rate limit event tracking
 * - profile-storage: Disk persistence
 * - profile-scorer: Profile availability scoring and auto-switch logic
 * - profile-utils: Helper utilities
 */

import { app } from 'electron';
import { join } from 'path';
import { mkdir } from 'fs/promises';
import type {
  ClaudeProfile,
  ClaudeProfileSettings,
  ClaudeUsageData,
  ClaudeRateLimitEvent,
  ClaudeAutoSwitchSettings
} from '../shared/types';

// Module imports
import { encryptToken, decryptToken } from './claude-profile/token-encryption';
import { parseUsageOutput } from './claude-profile/usage-parser';
import {
  recordRateLimitEvent as recordRateLimitEventImpl,
  isProfileRateLimited as isProfileRateLimitedImpl,
  clearRateLimitEvents as clearRateLimitEventsImpl
} from './claude-profile/rate-limit-manager';
import {
  loadProfileStore,
  loadProfileStoreAsync,
  saveProfileStore,
  ProfileStoreData,
  DEFAULT_AUTO_SWITCH_SETTINGS
} from './claude-profile/profile-storage';
import {
  getBestAvailableProfile,
  shouldProactivelySwitch as shouldProactivelySwitchImpl,
  getProfilesSortedByAvailability as getProfilesSortedByAvailabilityImpl
} from './claude-profile/profile-scorer';
import {
  DEFAULT_CLAUDE_CONFIG_DIR,
  generateProfileId as generateProfileIdImpl,
  createProfileDirectory as createProfileDirectoryImpl,
  isProfileAuthenticated as isProfileAuthenticatedImpl,
  hasValidToken,
  expandHomePath
} from './claude-profile/profile-utils';

/**
 * Manages Claude Code profiles for multi-account support.
 * Profiles are stored in the app's userData directory.
 * Each profile points to a separate Claude config directory.
 */
export class ClaudeProfileManager {
  private storePath: string;
  private configDir: string;
  private data: ProfileStoreData;
  private initialized: boolean = false;

  constructor() {
    this.configDir = join(app.getPath('userData'), 'config');
    this.storePath = join(this.configDir, 'claude-profiles.json');

    // DON'T do file I/O here - defer to async initialize()
    // Start with default data until initialized
    this.data = this.createDefaultData();
  }

  /**
   * Initialize the profile manager asynchronously (non-blocking)
   * This should be called at app startup via initializeClaudeProfileManager()
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    // Ensure directory exists (async) - mkdir with recursive:true is idempotent
    await mkdir(this.configDir, { recursive: true });

    // Load existing data asynchronously
    const loadedData = await loadProfileStoreAsync(this.storePath);
    if (loadedData) {
      this.data = loadedData;
    }

    // Run one-time migration to fix corrupted emails
    // This repairs emails that were truncated due to ANSI escape codes in terminal output
    this.migrateCorruptedEmails();

    this.initialized = true;
  }

  /**
   * One-time migration to fix emails that were corrupted by ANSI escape codes
   * during terminal output parsing.
   *
   * This reads the authoritative email from Claude's config file (.claude.json)
   * for each profile and updates any that differ from what we have stored.
   */
  private migrateCorruptedEmails(): void {
    let needsSave = false;

    for (const profile of this.data.profiles) {
      if (!profile.configDir) {
        continue;
      }

      // Import dynamically to avoid circular dependency issues
      const { getEmailFromConfigDir } = require('./claude-profile/profile-utils');
      const configEmail = getEmailFromConfigDir(profile.configDir);

      if (configEmail && profile.email !== configEmail) {
        console.warn('[ClaudeProfileManager] Migrating corrupted email for profile:', {
          profileId: profile.id,
          oldEmail: profile.email,
          newEmail: configEmail
        });
        profile.email = configEmail;
        needsSave = true;
      }
    }

    if (needsSave) {
      this.save();
      console.warn('[ClaudeProfileManager] Email migration complete');
    }
  }

  /**
   * Check if the profile manager has been initialized
   */
  isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * Load profiles from disk
   */
  private load(): ProfileStoreData {
    const loadedData = loadProfileStore(this.storePath);
    if (loadedData) {
      if (process.env.DEBUG === 'true') {
        console.warn('[ClaudeProfileManager] Loaded profiles:', {
          count: loadedData.profiles.length,
          activeProfileId: loadedData.activeProfileId,
          profiles: loadedData.profiles.map(p => ({
            id: p.id,
            name: p.name,
            email: p.email,
            isDefault: p.isDefault
          }))
        });
      }
      return loadedData;
    }

    // Return default with a single "Default" profile
    return this.createDefaultData();
  }

  /**
   * Create default profile data
   */
  private createDefaultData(): ProfileStoreData {
    const defaultProfile: ClaudeProfile = {
      id: 'default',
      name: 'Default',
      configDir: DEFAULT_CLAUDE_CONFIG_DIR,
      isDefault: true,
      description: 'Default Claude configuration (~/.claude)',
      createdAt: new Date()
    };

    return {
      version: 3,
      profiles: [defaultProfile],
      activeProfileId: 'default',
      autoSwitch: DEFAULT_AUTO_SWITCH_SETTINGS
    };
  }

  /**
   * Save profiles to disk
   */
  private save(): void {
    saveProfileStore(this.storePath, this.data);
  }

  /**
   * Get all profiles and settings
   * Computes isAuthenticated for each profile by checking configDir credentials
   */
  getSettings(): ClaudeProfileSettings {
    // Compute isAuthenticated for each profile
    const profilesWithAuth = this.data.profiles.map(profile => ({
      ...profile,
      isAuthenticated: this.isProfileAuthenticated(profile) || hasValidToken(profile)
    }));

    return {
      profiles: profilesWithAuth,
      activeProfileId: this.data.activeProfileId,
      autoSwitch: this.data.autoSwitch || DEFAULT_AUTO_SWITCH_SETTINGS
    };
  }

  /**
   * Get auto-switch settings
   */
  getAutoSwitchSettings(): ClaudeAutoSwitchSettings {
    return this.data.autoSwitch || DEFAULT_AUTO_SWITCH_SETTINGS;
  }

  /**
   * Update auto-switch settings
   */
  updateAutoSwitchSettings(settings: Partial<ClaudeAutoSwitchSettings>): void {
    this.data.autoSwitch = {
      ...(this.data.autoSwitch || DEFAULT_AUTO_SWITCH_SETTINGS),
      ...settings
    };
    this.save();
  }

  /**
   * Get unified account priority order
   * Returns array of account IDs in priority order (first = highest priority)
   * IDs are prefixed: 'oauth-{profileId}' for OAuth, 'api-{profileId}' for API profiles
   */
  getAccountPriorityOrder(): string[] {
    return this.data.accountPriorityOrder || [];
  }

  /**
   * Set unified account priority order
   * @param order Array of account IDs in priority order
   */
  setAccountPriorityOrder(order: string[]): void {
    this.data.accountPriorityOrder = order;
    this.save();
  }

  /**
   * Get a specific profile by ID
   */
  getProfile(profileId: string): ClaudeProfile | undefined {
    return this.data.profiles.find(p => p.id === profileId);
  }

  /**
   * Get the active profile
   */
  getActiveProfile(): ClaudeProfile {
    const active = this.data.profiles.find(p => p.id === this.data.activeProfileId);
    if (!active) {
      // Fallback to default
      const defaultProfile = this.data.profiles.find(p => p.isDefault);
      if (defaultProfile) {
        if (process.env.DEBUG === 'true') {
          console.warn('[ClaudeProfileManager] getActiveProfile - using default:', {
            id: defaultProfile.id,
            name: defaultProfile.name,
            email: defaultProfile.email
          });
        }
        return defaultProfile;
      }
      // If somehow no default exists, return first profile
      const fallback = this.data.profiles[0];
      if (process.env.DEBUG === 'true') {
        console.warn('[ClaudeProfileManager] getActiveProfile - using fallback:', {
          id: fallback.id,
          name: fallback.name,
          email: fallback.email
        });
      }
      return fallback;
    }

    if (process.env.DEBUG === 'true') {
      console.warn('[ClaudeProfileManager] getActiveProfile:', {
        id: active.id,
        name: active.name,
        email: active.email
      });
    }

    return active;
  }

  /**
   * Save or update a profile
   */
  saveProfile(profile: ClaudeProfile): ClaudeProfile {
    // Expand ~ in configDir path
    if (profile.configDir) {
      profile.configDir = expandHomePath(profile.configDir);
    }

    const index = this.data.profiles.findIndex(p => p.id === profile.id);

    if (index >= 0) {
      // Update existing
      this.data.profiles[index] = profile;
    } else {
      // Add new
      this.data.profiles.push(profile);
    }

    this.save();
    return profile;
  }

  /**
   * Delete a profile (cannot delete default or last profile)
   */
  deleteProfile(profileId: string): boolean {
    const profile = this.getProfile(profileId);
    if (!profile) {
      return false;
    }

    // Cannot delete default profile
    if (profile.isDefault) {
      return false;
    }

    // Cannot delete if it's the only profile
    if (this.data.profiles.length <= 1) {
      return false;
    }

    // Remove the profile
    this.data.profiles = this.data.profiles.filter(p => p.id !== profileId);

    // If we deleted the active profile, switch to default
    if (this.data.activeProfileId === profileId) {
      const defaultProfile = this.data.profiles.find(p => p.isDefault);
      this.data.activeProfileId = defaultProfile?.id || this.data.profiles[0].id;
    }

    this.save();
    return true;
  }

  /**
   * Rename a profile
   */
  renameProfile(profileId: string, newName: string): boolean {
    const profile = this.getProfile(profileId);
    if (!profile) {
      return false;
    }

    // Cannot rename to empty name
    if (!newName.trim()) {
      return false;
    }

    profile.name = newName.trim();
    this.save();
    return true;
  }

  /**
   * Set the active profile
   */
  setActiveProfile(profileId: string): boolean {
    const previousProfileId = this.data.activeProfileId;
    const profile = this.getProfile(profileId);
    if (!profile) {
      console.warn('[ClaudeProfileManager] setActiveProfile failed - profile not found:', { profileId });
      return false;
    }

    if (process.env.DEBUG === 'true') {
      console.warn('[ClaudeProfileManager] setActiveProfile:', {
        from: previousProfileId,
        to: profileId,
        profileName: profile.name
      });
    }

    this.data.activeProfileId = profileId;
    profile.lastUsedAt = new Date();
    this.save();
    return true;
  }

  /**
   * Update last used timestamp for a profile
   */
  markProfileUsed(profileId: string): void {
    const profile = this.getProfile(profileId);
    if (profile) {
      profile.lastUsedAt = new Date();
      this.save();
    }
  }

  /**
   * Get the OAuth token for the active profile (decrypted).
   * Returns undefined if no token is set (profile needs authentication).
   */
  getActiveProfileToken(): string | undefined {
    const profile = this.getActiveProfile();
    if (!profile?.oauthToken) {
      return undefined;
    }
    // Decrypt the token before returning
    return decryptToken(profile.oauthToken);
  }

  /**
   * Get the decrypted OAuth token for a specific profile.
   */
  getProfileToken(profileId: string): string | undefined {
    const profile = this.getProfile(profileId);
    if (!profile?.oauthToken) {
      return undefined;
    }
    return decryptToken(profile.oauthToken);
  }

  /**
   * Set the OAuth token for a profile (encrypted storage).
   * Used when capturing token from `claude setup-token` output.
   */
  setProfileToken(profileId: string, token: string, email?: string): boolean {
    const profile = this.getProfile(profileId);
    if (!profile) {
      return false;
    }

    // Encrypt the token before storing
    profile.oauthToken = encryptToken(token);
    profile.tokenCreatedAt = new Date();
    if (email) {
      profile.email = email;
    }

    // Clear any rate limit events since this might be a new account
    profile.rateLimitEvents = [];

    this.save();
    return true;
  }

  /**
   * Check if a profile has a valid OAuth token.
   * Token is valid for 1 year from creation.
   */
  hasValidToken(profileId: string): boolean {
    const profile = this.getProfile(profileId);
    if (!profile) {
      return false;
    }
    return hasValidToken(profile);
  }

  /**
   * Get environment variables for spawning processes with the active profile.
   *
   * IMPORTANT: Always uses CLAUDE_CONFIG_DIR to let Claude CLI read fresh tokens from Keychain.
   * We NEVER use cached OAuth tokens (CLAUDE_CODE_OAUTH_TOKEN) because:
   * 1. OAuth tokens expire in 8-12 hours
   * 2. Claude CLI's token refresh mechanism works (updates Keychain)
   * 3. Cached tokens don't benefit from Claude CLI's automatic refresh
   * 4. CLAUDE_CODE_OAUTH_TOKEN doesn't include subscription tier info
   *
   * By using CLAUDE_CONFIG_DIR, Claude CLI reads fresh tokens from Keychain each time,
   * which includes any refreshed tokens and full credential metadata.
   *
   * See: docs/LONG_LIVED_AUTH_PLAN.md for full context.
   */
  getActiveProfileEnv(): Record<string, string> {
    const profile = this.getActiveProfile();
    const env: Record<string, string> = {};

    // Default profile: Claude CLI uses ~/.claude implicitly (no env var needed)
    if (profile?.isDefault) {
      console.warn('[ClaudeProfileManager] Using default profile (Claude CLI uses ~/.claude)');
      return env;
    }

    // Non-default profiles: set CLAUDE_CONFIG_DIR to point Claude CLI to profile's config
    // Claude CLI will read fresh tokens from Keychain, benefiting from auto-refresh
    if (profile?.configDir) {
      // Expand ~ to home directory for the environment variable
      const expandedConfigDir = profile.configDir.startsWith('~')
        ? profile.configDir.replace(/^~/, require('os').homedir())
        : profile.configDir;
      env.CLAUDE_CONFIG_DIR = expandedConfigDir;
      console.warn('[ClaudeProfileManager] Using CLAUDE_CONFIG_DIR for profile:', profile.name, expandedConfigDir);
    } else {
      console.warn('[ClaudeProfileManager] Profile has no configDir configured:', profile?.name);
    }

    return env;
  }

  /**
   * Update usage data for a profile (parsed from /usage output)
   */
  updateProfileUsage(profileId: string, usageOutput: string): ClaudeUsageData | null {
    const profile = this.getProfile(profileId);
    if (!profile) {
      return null;
    }

    const usage = parseUsageOutput(usageOutput);
    profile.usage = usage;
    this.save();
    return usage;
  }

  /**
   * Update usage data for a profile from API response (percentages directly)
   * This is called by the usage monitor after fetching usage via the API
   */
  updateProfileUsageFromAPI(profileId: string, sessionPercent: number, weeklyPercent: number): ClaudeUsageData | null {
    const profile = this.getProfile(profileId);
    if (!profile) {
      return null;
    }

    // Preserve existing reset times if available, otherwise use empty string
    const existingUsage = profile.usage;
    const usage: ClaudeUsageData = {
      sessionUsagePercent: sessionPercent,
      sessionResetTime: existingUsage?.sessionResetTime ?? '',
      weeklyUsagePercent: weeklyPercent,
      weeklyResetTime: existingUsage?.weeklyResetTime ?? '',
      opusUsagePercent: existingUsage?.opusUsagePercent,
      lastUpdated: new Date()
    };
    profile.usage = usage;
    this.save();
    return usage;
  }

  /**
   * Batch update usage data for multiple profiles from API responses.
   * Updates all profiles in memory first, then saves once to avoid race conditions.
   *
   * @param updates - Array of { profileId, sessionPercent, weeklyPercent } objects
   * @returns Number of profiles successfully updated
   */
  batchUpdateProfileUsageFromAPI(
    updates: Array<{ profileId: string; sessionPercent: number; weeklyPercent: number }>
  ): number {
    let updatedCount = 0;

    for (const { profileId, sessionPercent, weeklyPercent } of updates) {
      const profile = this.getProfile(profileId);
      if (!profile) {
        continue;
      }

      // Preserve existing reset times if available
      const existingUsage = profile.usage;
      const usage: ClaudeUsageData = {
        sessionUsagePercent: sessionPercent,
        sessionResetTime: existingUsage?.sessionResetTime ?? '',
        weeklyUsagePercent: weeklyPercent,
        weeklyResetTime: existingUsage?.weeklyResetTime ?? '',
        opusUsagePercent: existingUsage?.opusUsagePercent,
        lastUpdated: new Date()
      };
      profile.usage = usage;
      updatedCount++;
    }

    // Single save after all updates
    if (updatedCount > 0) {
      this.save();
    }

    return updatedCount;
  }

  /**
   * Record a rate limit event for a profile
   */
  recordRateLimitEvent(profileId: string, resetTimeStr: string): ClaudeRateLimitEvent {
    const profile = this.getProfile(profileId);
    if (!profile) {
      throw new Error('Profile not found');
    }

    const event = recordRateLimitEventImpl(profile, resetTimeStr);
    this.save();
    return event;
  }

  /**
   * Check if a profile is currently rate-limited
   */
  isProfileRateLimited(profileId: string): { limited: boolean; type?: 'session' | 'weekly'; resetAt?: Date } {
    const profile = this.getProfile(profileId);
    if (!profile) {
      return { limited: false };
    }
    return isProfileRateLimitedImpl(profile);
  }

  /**
   * Get the best profile to switch to based on usage and rate limit status
   * Returns null if no good alternative is available
   */
  getBestAvailableProfile(excludeProfileId?: string): ClaudeProfile | null {
    const settings = this.getAutoSwitchSettings();
    return getBestAvailableProfile(this.data.profiles, settings, excludeProfileId);
  }

  /**
   * Determine if we should proactively switch profiles based on current usage
   */
  shouldProactivelySwitch(profileId: string): { shouldSwitch: boolean; reason?: string; suggestedProfile?: ClaudeProfile } {
    const profile = this.getProfile(profileId);
    if (!profile) {
      return { shouldSwitch: false };
    }

    const settings = this.getAutoSwitchSettings();
    return shouldProactivelySwitchImpl(profile, this.data.profiles, settings);
  }

  /**
   * Generate a unique ID for a new profile
   */
  generateProfileId(name: string): string {
    return generateProfileIdImpl(name, this.data.profiles);
  }

  /**
   * Create a new profile directory and initialize it
   */
  async createProfileDirectory(profileName: string): Promise<string> {
    return createProfileDirectoryImpl(profileName);
  }

  /**
   * Check if a profile has valid authentication
   * (checks if the config directory has credential files)
   */
  isProfileAuthenticated(profile: ClaudeProfile): boolean {
    return isProfileAuthenticatedImpl(profile);
  }

  /**
   * Check if a profile has valid authentication for starting tasks.
   * A profile is considered authenticated if:
   * 1) It has a valid OAuth token (not expired), OR
   * 2) It has an authenticated configDir (credential files exist)
   *
   * @param profileId - Optional profile ID to check. If not provided, checks active profile.
   * @returns true if the profile can authenticate, false otherwise
   */
  hasValidAuth(profileId?: string): boolean {
    const profile = profileId ? this.getProfile(profileId) : this.getActiveProfile();
    if (!profile) {
      return false;
    }

    // Check 1: Profile has a valid OAuth token
    if (hasValidToken(profile)) {
      return true;
    }

    // Check 2 & 3: Profile has authenticated configDir (works for both default and non-default)
    if (this.isProfileAuthenticated(profile)) {
      return true;
    }

    return false;
  }

  /**
   * Get environment variables for invoking Claude with a specific profile
   */
  getProfileEnv(profileId: string): Record<string, string> {
    const profile = this.getProfile(profileId);
    if (!profile) {
      return {};
    }

    // Only set CLAUDE_CONFIG_DIR if not using default
    if (profile.isDefault) {
      return {};
    }

    // Only set CLAUDE_CONFIG_DIR if configDir is defined
    if (!profile.configDir) {
      return {};
    }

    return {
      CLAUDE_CONFIG_DIR: profile.configDir
    };
  }

  /**
   * Clear rate limit events for a profile (e.g., when they've reset)
   */
  clearRateLimitEvents(profileId: string): void {
    const profile = this.getProfile(profileId);
    if (profile) {
      clearRateLimitEventsImpl(profile);
      this.save();
    }
  }

  /**
   * Get profiles sorted by availability (best first)
   */
  getProfilesSortedByAvailability(): ClaudeProfile[] {
    return getProfilesSortedByAvailabilityImpl(this.data.profiles);
  }
}

// Singleton instance and initialization promise
let profileManager: ClaudeProfileManager | null = null;
let initPromise: Promise<ClaudeProfileManager> | null = null;

/**
 * Get the singleton Claude profile manager instance
 * Note: For async contexts, prefer initializeClaudeProfileManager() to ensure initialization
 */
export function getClaudeProfileManager(): ClaudeProfileManager {
  if (!profileManager) {
    profileManager = new ClaudeProfileManager();
  }
  return profileManager;
}

/**
 * Initialize and get the singleton Claude profile manager instance (async)
 * This ensures the profile manager is fully initialized before use.
 * Uses promise caching to prevent concurrent initialization.
 * The cached promise is reset on failure to allow retries after transient errors.
 */
export async function initializeClaudeProfileManager(): Promise<ClaudeProfileManager> {
  if (!profileManager) {
    profileManager = new ClaudeProfileManager();
  }

  // If already initialized, return immediately
  if (profileManager.isInitialized()) {
    return profileManager;
  }

  // If initialization is in progress, wait for it (promise caching)
  if (!initPromise) {
    initPromise = profileManager.initialize()
      .then(() => {
        return profileManager!;
      })
      .catch((error) => {
        // Reset cached promise on failure so retries can succeed
        // This allows recovery from transient errors (e.g., disk full, permission issues)
        initPromise = null;
        throw error;
      });
  }

  return initPromise;
}

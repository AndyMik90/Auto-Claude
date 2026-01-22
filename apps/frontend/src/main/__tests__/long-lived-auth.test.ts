/**
 * Tests for Long-Lived Auth Fix
 *
 * Verifies that getProfileEnv() always uses CLAUDE_CONFIG_DIR
 * instead of cached OAuth tokens (CLAUDE_CODE_OAUTH_TOKEN).
 *
 * See: docs/LONG_LIVED_AUTH_PLAN.md
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the profile manager
const mockGetProfile = vi.fn();
const mockGetActiveProfile = vi.fn();
const mockGetProfileToken = vi.fn();
const mockGetActiveProfileToken = vi.fn();

vi.mock('../claude-profile-manager', () => ({
  getClaudeProfileManager: () => ({
    getProfile: mockGetProfile,
    getActiveProfile: mockGetActiveProfile,
    getProfileToken: mockGetProfileToken,
    getActiveProfileToken: mockGetActiveProfileToken,
  }),
}));

// Import after mocking
import { getProfileEnv } from '../rate-limit-detector';

describe('Long-Lived Auth Fix', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getProfileEnv', () => {
    it('should return empty env for default profile (Claude CLI uses ~/.claude)', () => {
      mockGetActiveProfile.mockReturnValue({
        id: 'default',
        name: 'Default',
        isDefault: true,
        configDir: '/Users/test/.claude',
        oauthToken: 'enc:some-encrypted-token', // Even with token, should use default
      });

      const env = getProfileEnv();

      expect(env).toEqual({});
      // Should NOT call getProfileToken or getActiveProfileToken
      expect(mockGetProfileToken).not.toHaveBeenCalled();
      expect(mockGetActiveProfileToken).not.toHaveBeenCalled();
    });

    it('should return CLAUDE_CONFIG_DIR for non-default profile with configDir', () => {
      mockGetActiveProfile.mockReturnValue({
        id: 'work-profile',
        name: 'Work',
        isDefault: false,
        configDir: '/Users/test/.claude-profiles/work',
        oauthToken: 'enc:some-encrypted-token', // Should be IGNORED
      });

      const env = getProfileEnv();

      expect(env).toEqual({
        CLAUDE_CONFIG_DIR: '/Users/test/.claude-profiles/work',
      });
      // Should NOT use the cached token - this is the key fix!
      expect(mockGetProfileToken).not.toHaveBeenCalled();
      expect(mockGetActiveProfileToken).not.toHaveBeenCalled();
    });

    it('should NOT return CLAUDE_CODE_OAUTH_TOKEN even when profile has oauthToken', () => {
      mockGetActiveProfile.mockReturnValue({
        id: 'personal-profile',
        name: 'Personal',
        isDefault: false,
        configDir: '/Users/test/.claude-profiles/personal',
        oauthToken: 'enc:stale-cached-token-that-would-cause-401',
        tokenCreatedAt: new Date('2024-01-01'), // Old token
      });

      const env = getProfileEnv();

      // Key assertion: Should NEVER return CLAUDE_CODE_OAUTH_TOKEN
      expect(env.CLAUDE_CODE_OAUTH_TOKEN).toBeUndefined();
      expect(env.CLAUDE_CONFIG_DIR).toBe('/Users/test/.claude-profiles/personal');
    });

    it('should return empty env for profile without configDir (edge case)', () => {
      mockGetActiveProfile.mockReturnValue({
        id: 'broken-profile',
        name: 'Broken',
        isDefault: false,
        configDir: undefined, // No configDir configured
        oauthToken: 'enc:token-without-configdir',
      });

      const env = getProfileEnv();

      // Without configDir, cannot authenticate via CLAUDE_CONFIG_DIR
      // Should NOT fall back to oauthToken (that's the bug we're fixing)
      expect(env).toEqual({});
      expect(env.CLAUDE_CODE_OAUTH_TOKEN).toBeUndefined();
    });

    it('should use specific profile when profileId is provided', () => {
      mockGetProfile.mockReturnValue({
        id: 'specific-profile',
        name: 'Specific',
        isDefault: false,
        configDir: '/Users/test/.claude-profiles/specific',
      });

      const env = getProfileEnv('specific-profile');

      expect(mockGetProfile).toHaveBeenCalledWith('specific-profile');
      expect(env).toEqual({
        CLAUDE_CONFIG_DIR: '/Users/test/.claude-profiles/specific',
      });
    });
  });
});

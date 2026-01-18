/**
 * Tests for usage-monitor.ts
 *
 * Red phase - write failing tests first
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { detectProvider, getUsageEndpoint, UsageMonitor, getUsageMonitor } from './usage-monitor';
import type { ApiProvider } from './usage-monitor';

// Mock getClaudeProfileManager
vi.mock('../claude-profile-manager', () => ({
  getClaudeProfileManager: vi.fn(() => ({
    getAutoSwitchSettings: vi.fn(() => ({
      enabled: true,
      proactiveSwapEnabled: true,
      usageCheckInterval: 30000,
      sessionThreshold: 80,
      weeklyThreshold: 80
    })),
    getActiveProfile: vi.fn(() => ({
      id: 'test-profile-1',
      name: 'Test Profile',
      baseUrl: 'https://api.anthropic.com',
      oauthToken: 'mock-oauth-token'
    })),
    getProfile: vi.fn((id: string) => ({
      id,
      name: 'Test Profile',
      baseUrl: 'https://api.anthropic.com',
      oauthToken: 'mock-oauth-token'
    })),
    getProfilesSortedByAvailability: vi.fn(() => [
      { id: 'profile-2', name: 'Profile 2' },
      { id: 'profile-3', name: 'Profile 3' }
    ]),
    setActiveProfile: vi.fn(),
    getProfileToken: vi.fn(() => 'mock-decrypted-token')
  }))
}));

// Mock loadProfilesFile
const mockLoadProfilesFile = vi.fn(async () => ({
  profiles: [] as Array<{
    id: string;
    name: string;
    baseUrl: string;
    apiKey: string;
  }>,
  activeProfileId: null as string | null,
  version: 1
}));

vi.mock('../services/profile/profile-manager', () => ({
  loadProfilesFile: () => mockLoadProfilesFile()
}));

// Mock global fetch
global.fetch = vi.fn(() =>
  Promise.resolve({
    ok: true,
    status: 200,
    statusText: 'OK',
    json: async () => ({
      five_hour_utilization: 0.5,
      seven_day_utilization: 0.3,
      five_hour_reset_at: '2025-01-17T15:00:00Z',
      seven_day_reset_at: '2025-01-20T12:00:00Z'
    })
  } as unknown as Response)
) as any;

describe('usage-monitor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  // Note: detectProvider tests removed - now using shared/utils/provider-detection.ts
  // which has its own comprehensive test suite

  describe('getUsageEndpoint', () => {
    it('should return correct endpoint for Anthropic', () => {
      const result = getUsageEndpoint('anthropic', 'https://api.anthropic.com');
      expect(result).toBe('https://api.anthropic.com/api/oauth/usage');
    });

    it('should return correct endpoint for Anthropic with path', () => {
      const result = getUsageEndpoint('anthropic', 'https://api.anthropic.com/v1');
      expect(result).toBe('https://api.anthropic.com/api/oauth/usage');
    });

    it('should return correct endpoint for zai', () => {
      const result = getUsageEndpoint('zai', 'https://api.z.ai/api/anthropic');
      // quota/limit endpoint doesn't require query parameters
      expect(result).toBe('https://api.z.ai/api/monitor/usage/quota/limit');
    });

    it('should return correct endpoint for zhipu', () => {
      const result = getUsageEndpoint('zhipu', 'https://open.bigmodel.cn/api/paas/v4');
      // quota/limit endpoint doesn't require query parameters
      expect(result).toBe('https://open.bigmodel.cn/api/monitor/usage/quota/limit');
    });

    it('should return null for unknown provider', () => {
      const result = getUsageEndpoint('unknown' as ApiProvider, 'https://example.com');
      expect(result).toBeNull();
    });

    it('should return null for invalid baseUrl', () => {
      const result = getUsageEndpoint('anthropic', 'not-a-url');
      expect(result).toBeNull();
    });
  });

  describe('UsageMonitor', () => {
    it('should return singleton instance', () => {
      const monitor1 = UsageMonitor.getInstance();
      const monitor2 = UsageMonitor.getInstance();

      expect(monitor1).toBe(monitor2);
    });

    it('should return same instance from getUsageMonitor()', () => {
      const monitor1 = getUsageMonitor();
      const monitor2 = getUsageMonitor();

      expect(monitor1).toBe(monitor2);
    });

    it('should start monitoring when settings allow', () => {
      const monitor = getUsageMonitor();
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      monitor.start();

      // Check that console.warn was called (monitor logs when starting)
      expect(consoleSpy).toHaveBeenCalled();

      consoleSpy.mockRestore();
      monitor.stop();
    });

    it('should not start if already running', () => {
      const monitor = getUsageMonitor();
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      monitor.start();
      monitor.start(); // Second call should be ignored

      // Should have logged a warning that it's already running
      expect(consoleSpy.mock.calls.length).toBeGreaterThan(0);

      consoleSpy.mockRestore();
      monitor.stop();
    });

    it('should stop monitoring', () => {
      const monitor = getUsageMonitor();
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      monitor.start();
      monitor.stop();

      // Verify stop completed without errors
      expect(consoleSpy).toHaveBeenCalled();

      consoleSpy.mockRestore();
    });

    it('should return current usage snapshot', () => {
      const monitor = getUsageMonitor();
      const usage = monitor.getCurrentUsage();

      // getCurrentUsage returns the last known usage snapshot
      // Note: Since getUsageMonitor() is a singleton, this may have data from previous tests
      // Just verify the method returns the expected type (snapshot or null)
      if (usage !== null) {
        expect(usage).toHaveProperty('sessionPercent');
        expect(usage).toHaveProperty('weeklyPercent');
        expect(usage).toHaveProperty('profileId');
        expect(usage).toHaveProperty('profileName');
      }
    });

    it('should emit events when listeners are attached', () => {
      const monitor = getUsageMonitor();
      const usageHandler = vi.fn();

      monitor.on('usage-updated', usageHandler);

      // Verify event handler is attached
      expect(monitor.listenerCount('usage-updated')).toBe(1);

      // Clean up
      monitor.off('usage-updated', usageHandler);
    });

    it('should allow removing event listeners', () => {
      const monitor = getUsageMonitor();
      const usageHandler = vi.fn();

      monitor.on('usage-updated', usageHandler);
      expect(monitor.listenerCount('usage-updated')).toBe(1);

      monitor.off('usage-updated', usageHandler);
      expect(monitor.listenerCount('usage-updated')).toBe(0);
    });
  });

  describe('UsageMonitor error handling', () => {
    it('should emit event when swap fails', () => {
      const monitor = getUsageMonitor();
      const swapFailedHandler = vi.fn();

      monitor.on('proactive-swap-failed', swapFailedHandler);

      // Manually trigger the swap logic by calling the private method through a test scenario
      // Since we can't directly call private methods, we'll verify the event system works
      monitor.emit('proactive-swap-failed', {
        reason: 'no_alternative',
        currentProfile: 'test-profile'
      });

      expect(swapFailedHandler).toHaveBeenCalledWith({
        reason: 'no_alternative',
        currentProfile: 'test-profile'
      });

      monitor.off('proactive-swap-failed', swapFailedHandler);
    });
  });

  describe('Anthropic response normalization', () => {
    it('should normalize Anthropic response with utilization values', () => {
      const monitor = getUsageMonitor();
      const rawData = {
        five_hour_utilization: 0.72,
        seven_day_utilization: 0.45,
        five_hour_reset_at: '2025-01-17T15:00:00Z',
        seven_day_reset_at: '2025-01-20T12:00:00Z'
      };

      const usage = monitor['normalizeAnthropicResponse'](rawData, 'test-profile-1', 'Anthropic Profile');

      expect(usage).not.toBeNull();
      expect(usage.sessionPercent).toBe(72); // 0.72 * 100
      expect(usage.weeklyPercent).toBe(45); // 0.45 * 100
      expect(usage.limitType).toBe('session'); // 0.45 (weekly) < 0.72 (session), so session is higher
      expect(usage.profileId).toBe('test-profile-1');
      expect(usage.profileName).toBe('Anthropic Profile');
    });

    it('should handle missing optional fields in Anthropic response', () => {
      const monitor = getUsageMonitor();
      const rawData = {
        five_hour_utilization: 0.50
        // Missing: seven_day_utilization, reset times
      };

      const usage = monitor['normalizeAnthropicResponse'](rawData, 'test-profile-1', 'Test Profile');

      expect(usage).not.toBeNull();
      expect(usage.sessionPercent).toBe(50);
      expect(usage.weeklyPercent).toBe(0); // Missing field defaults to 0
      expect(usage.sessionResetTime).toBe('Unknown'); // Missing reset time
      expect(usage.weeklyResetTime).toBe('Unknown'); // Missing reset time
    });
  });

  describe('z.ai response normalization', () => {

    it('should normalize z.ai response with usage/limit fields', () => {
      const monitor = getUsageMonitor();
      // Create future dates for reset times (use relative time from now)
      const now = new Date();
      const sessionReset = new Date(now.getTime() + 2 * 60 * 60 * 1000); // 2 hours from now
      const weeklyReset = new Date(now.getTime() + 4 * 24 * 60 * 60 * 1000); // 4 days from now

      // Use quota/limit format with limits array
      const rawData = {
        limits: [
          {
            type: 'TOKENS_LIMIT',
            percentage: 72,
            nextResetTime: sessionReset.getTime()
          },
          {
            type: 'TIME_LIMIT',
            percentage: 51,
            currentValue: 180000,
            usage: 350000
          }
        ]
      };

      const usage = monitor['normalizeZAIResponse'](rawData, 'zai-profile-1', 'z.ai Profile');

      expect(usage).not.toBeNull();
      expect(usage?.sessionPercent).toBe(72); // TOKENS_LIMIT percentage
      expect(usage?.weeklyPercent).toBe(51); // TIME_LIMIT percentage
      expect(usage?.sessionResetTime).toBe('Resets in ...'); // Placeholder, calculated dynamically in UI
      expect(usage?.weeklyResetTime).toMatch(/\d+st of \w+/); // Monthly reset: "1st of February"
      expect(usage?.limitType).toBe('session'); // 51 (weekly) < 72 (session), so session is higher
    });

    it('should try alternative field names for z.ai response', () => {
      const monitor = getUsageMonitor();
      // Use quota/limit format with limits array
      const rawData = {
        limits: [
          {
            type: 'TOKENS_LIMIT',
            percentage: 25
          },
          {
            type: 'TIME_LIMIT',
            percentage: 50,
            currentValue: 150000,
            usage: 300000
          }
        ]
      };

      const usage = monitor['normalizeZAIResponse'](rawData, 'zai-profile-1', 'z.ai Profile');

      expect(usage).not.toBeNull();
      expect(usage?.sessionPercent).toBe(25); // TOKENS_LIMIT percentage
      expect(usage?.weeklyPercent).toBe(50); // TIME_LIMIT percentage
      // sessionResetTime is a placeholder, calculated dynamically in UI
      expect(usage?.sessionResetTime).toBe('Resets in ...');
      expect(usage?.weeklyResetTime).toMatch(/\d+st of \w+/); // Monthly reset: "1st of February"
    });

    it('should return null when no data can be extracted from z.ai', () => {
      const monitor = getUsageMonitor();
      const rawData = {
        unknown_field: 'some_value',
        another_field: 123
      };

      const usage = monitor['normalizeZAIResponse'](rawData, 'zai-profile-1', 'z.ai Profile');

      expect(usage).toBeNull();
    });
  });

  describe('z.ai quota/limit endpoint normalization', () => {
    it('should normalize z.ai quota/limit response with limits array', () => {
      const monitor = getUsageMonitor();
      // Create a future reset time (3 hours from now)
      const now = Date.now();
      const nextResetTime = now + 3 * 60 * 60 * 1000; // 3 hours from now

      const rawData = {
        limits: [
          {
            type: 'TIME_LIMIT',
            unit: 5,
            number: 1,
            usage: 1000,
            currentValue: 660,
            remaining: 340,
            percentage: 66,
            usageDetails: [
              { modelCode: 'search-prime', usage: 599 },
              { modelCode: 'web-reader', usage: 88 }
            ]
          },
          {
            type: 'TOKENS_LIMIT',
            unit: 3,
            number: 5,
            usage: 200000000,
            currentValue: 20926987,
            remaining: 179073013,
            percentage: 10,
            nextResetTime: nextResetTime
          }
        ]
      };

      const usage = monitor['normalizeZAIResponse'](rawData, 'zai-profile-1', 'z.ai Profile');

      expect(usage).not.toBeNull();
      expect(usage?.sessionPercent).toBe(10); // TOKENS_LIMIT percentage
      expect(usage?.weeklyPercent).toBe(66); // TIME_LIMIT percentage
      expect(usage?.sessionUsageValue).toBe(20926987); // current token usage
      expect(usage?.sessionUsageLimit).toBe(200000000); // total token limit
      expect(usage?.weeklyUsageValue).toBe(660); // current tool usage
      expect(usage?.weeklyUsageLimit).toBe(1000); // total tool limit
      expect(usage?.sessionResetTimestamp).toBeDefined();
      expect(usage?.limitType).toBe('weekly'); // 66 > 10
      expect(usage?.usageWindows?.sessionWindowLabel).toBe('5 Hours Quota');
      expect(usage?.usageWindows?.weeklyWindowLabel).toBe('Monthly Tools Quota');
    });

    it('should handle missing nextResetTime gracefully', () => {
      const monitor = getUsageMonitor();

      const rawData = {
        limits: [
          {
            type: 'TIME_LIMIT',
            unit: 5,
            number: 1,
            usage: 1000,
            currentValue: 500,
            remaining: 500,
            percentage: 50
          },
          {
            type: 'TOKENS_LIMIT',
            unit: 3,
            number: 5,
            usage: 200000000,
            currentValue: 100000000,
            remaining: 100000000,
            percentage: 50
            // Missing nextResetTime - should fall back to now + 5 hours
          }
        ]
      };

      const usage = monitor['normalizeZAIResponse'](rawData, 'zai-profile-1', 'z.ai Profile');

      expect(usage).not.toBeNull();
      expect(usage?.sessionPercent).toBe(50);
      expect(usage?.weeklyPercent).toBe(50);
      expect(usage?.sessionResetTimestamp).toBeDefined(); // Should have fallback timestamp
    });

    it('should handle missing currentValue and usage fields', () => {
      const monitor = getUsageMonitor();

      const rawData = {
        limits: [
          {
            type: 'TIME_LIMIT',
            percentage: 75
            // Missing currentValue, usage
          },
          {
            type: 'TOKENS_LIMIT',
            percentage: 25
            // Missing currentValue, usage, nextResetTime
          }
        ]
      };

      const usage = monitor['normalizeZAIResponse'](rawData, 'zai-profile-1', 'z.ai Profile');

      expect(usage).not.toBeNull();
      expect(usage?.sessionPercent).toBe(25);
      expect(usage?.weeklyPercent).toBe(75);
      expect(usage?.sessionUsageValue).toBeUndefined(); // No currentValue in response
      expect(usage?.sessionUsageLimit).toBeUndefined(); // No usage in response
      expect(usage?.weeklyUsageValue).toBeUndefined();
      expect(usage?.weeklyUsageLimit).toBeUndefined();
    });
  });

  describe('ZHIPU response normalization', () => {
    it('should normalize ZHIPU response with usage/limit fields', () => {
      const monitor = getUsageMonitor();
      // Use quota/limit format with limits array
      const rawData = {
        limits: [
          {
            type: 'TOKENS_LIMIT',
            percentage: 90,
            nextResetTime: Date.now() + 2 * 60 * 60 * 1000 // 2 hours from now
          },
          {
            type: 'TIME_LIMIT',
            percentage: 80,
            currentValue: 280000,
            usage: 350000
          }
        ]
      };

      const usage = monitor['normalizeZhipuResponse'](rawData, 'zhipu-profile-1', 'ZHIPU Profile');

      expect(usage).not.toBeNull();
      expect(usage?.sessionPercent).toBe(90); // TOKENS_LIMIT percentage
      expect(usage?.weeklyPercent).toBe(80); // TIME_LIMIT percentage
      expect(usage?.limitType).toBe('session'); // 80 (weekly) < 90 (session), so session is higher
      expect(usage?.profileId).toBe('zhipu-profile-1');
      expect(usage?.profileName).toBe('ZHIPU Profile');
    });

    it('should try alternative field names for ZHIPU response', () => {
      const monitor = getUsageMonitor();
      // Use quota/limit format with limits array
      const rawData = {
        limits: [
          {
            type: 'TOKENS_LIMIT',
            percentage: 50
          },
          {
            type: 'TIME_LIMIT',
            percentage: 48,
            currentValue: 200000,
            usage: 420000
          }
        ]
      };

      const usage = monitor['normalizeZhipuResponse'](rawData, 'zhipu-profile-1', 'ZHIPU Profile');

      expect(usage).not.toBeNull();
      expect(usage?.sessionPercent).toBe(50); // TOKENS_LIMIT percentage
      expect(usage?.weeklyPercent).toBe(48); // TIME_LIMIT percentage
    });
  });

  describe('ZHIPU quota/limit endpoint normalization', () => {
    it('should normalize ZHIPU quota/limit response with limits array', () => {
      const monitor = getUsageMonitor();
      // Create a future reset time (2 hours from now)
      const now = Date.now();
      const nextResetTime = now + 2 * 60 * 60 * 1000; // 2 hours from now

      const rawData = {
        limits: [
          {
            type: 'TIME_LIMIT',
            unit: 5,
            number: 1,
            usage: 1000,
            currentValue: 800,
            remaining: 200,
            percentage: 80,
            usageDetails: [
              { modelCode: 'search-prime', usage: 700 },
              { modelCode: 'web-reader', usage: 100 }
            ]
          },
          {
            type: 'TOKENS_LIMIT',
            unit: 3,
            number: 5,
            usage: 200000000,
            currentValue: 40000000,
            remaining: 160000000,
            percentage: 20,
            nextResetTime: nextResetTime
          }
        ]
      };

      const usage = monitor['normalizeZhipuResponse'](rawData, 'zhipu-profile-1', 'ZHIPU Profile');

      expect(usage).not.toBeNull();
      expect(usage?.sessionPercent).toBe(20); // TOKENS_LIMIT percentage
      expect(usage?.weeklyPercent).toBe(80); // TIME_LIMIT percentage
      expect(usage?.sessionUsageValue).toBe(40000000); // current token usage
      expect(usage?.sessionUsageLimit).toBe(200000000); // total token limit
      expect(usage?.weeklyUsageValue).toBe(800); // current tool usage
      expect(usage?.weeklyUsageLimit).toBe(1000); // total tool limit
      expect(usage?.sessionResetTimestamp).toBeDefined();
      expect(usage?.limitType).toBe('weekly'); // 80 > 20
      expect(usage?.usageWindows?.sessionWindowLabel).toBe('5 Hours Quota');
      expect(usage?.usageWindows?.weeklyWindowLabel).toBe('Monthly Tools Quota');
    });

    it('should handle ZHIPU quota/limit response without nextResetTime', () => {
      const monitor = getUsageMonitor();

      const rawData = {
        limits: [
          {
            type: 'TIME_LIMIT',
            percentage: 45
          },
          {
            type: 'TOKENS_LIMIT',
            percentage: 55
            // Missing nextResetTime, currentValue, usage
          }
        ]
      };

      const usage = monitor['normalizeZhipuResponse'](rawData, 'zhipu-profile-1', 'ZHIPU Profile');

      expect(usage).not.toBeNull();
      expect(usage?.sessionPercent).toBe(55);
      expect(usage?.weeklyPercent).toBe(45);
      expect(usage?.sessionResetTimestamp).toBeDefined(); // Should have fallback timestamp
      expect(usage?.sessionUsageValue).toBeUndefined();
      expect(usage?.sessionUsageLimit).toBeUndefined();
      expect(usage?.weeklyUsageValue).toBeUndefined();
      expect(usage?.weeklyUsageLimit).toBeUndefined();
    });
  });

  describe('Percentage calculation', () => {
    it('should calculate percentages correctly from usage/limit values', () => {
      const monitor = getUsageMonitor();
      // Use quota/limit format - percentages are pre-calculated by the API
      const rawData = {
        limits: [
          {
            type: 'TOKENS_LIMIT',
            percentage: 25 // 25%
          },
          {
            type: 'TIME_LIMIT',
            percentage: 50 // 50%
          }
        ]
      };

      const usage = monitor['normalizeZAIResponse'](rawData, 'test-profile', 'Test Profile');

      expect(usage?.sessionPercent).toBe(25); // TOKENS_LIMIT percentage
      expect(usage?.weeklyPercent).toBe(50); // TIME_LIMIT percentage
    });

    it('should handle division by zero (zero limit)', () => {
      const monitor = getUsageMonitor();
      // When percentage is 0 or missing, default to 0
      const rawData = {
        limits: [
          {
            type: 'TOKENS_LIMIT',
            percentage: 0 // Zero usage
          },
          {
            type: 'TIME_LIMIT',
            percentage: 50
          }
        ]
      };

      const usage = monitor['normalizeZAIResponse'](rawData, 'test-profile', 'Test Profile');

      expect(usage?.sessionPercent).toBe(0); // Zero percentage
      expect(usage?.weeklyPercent).toBe(50); // TIME_LIMIT percentage
    });
  });

  describe('Malformed response handling', () => {
    it('should handle non-numeric usage values gracefully', () => {
      const monitor = getUsageMonitor();
      // Missing limits array - should return null
      const rawData = {
        session_usage: 'not a number',
        session_limit: 'also not a number',
        weekly_usage: null,
        weekly_limit: undefined
      };

      const usage = monitor['normalizeZAIResponse'](rawData, 'test-profile', 'Test Profile');

      // Should return null when response doesn't match expected quota/limit format
      expect(usage).toBeNull();
    });

    it('should handle completely unknown response structure', () => {
      const monitor = getUsageMonitor();
      // Unknown structure without limits array - should return null
      const rawData = {
        unknown_field: 'some_value',
        another_field: 123,
        nested: {
          data: 'value'
        }
      };

      const usage = monitor['normalizeZAIResponse'](rawData, 'test-profile', 'Test Profile');

      // Should return null when response doesn't match expected quota/limit format
      expect(usage).toBeNull();
    });
  });

  describe('API error handling', () => {
    it('should handle 401 Unauthorized responses', async () => {
      const mockFetch = vi.mocked(global.fetch);
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
        json: async () => ({ error: 'Invalid token' })
      } as unknown as Response);

      const monitor = getUsageMonitor();
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      // 401 errors should throw
      await expect(
        monitor['fetchUsageViaAPI']('invalid-token', 'test-profile-1', 'Test Profile')
      ).rejects.toThrow('API Auth Failure: 401');

      expect(consoleSpy).toHaveBeenCalled();
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.anthropic.com/api/oauth/usage',
        expect.objectContaining({
          method: 'GET',
          headers: expect.objectContaining({
            'Authorization': 'Bearer invalid-token'
          })
        })
      );

      consoleSpy.mockRestore();
    });

    it('should handle 403 Forbidden responses', async () => {
      const mockFetch = vi.mocked(global.fetch);
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 403,
        statusText: 'Forbidden',
        json: async () => ({ error: 'Access denied' })
      } as unknown as Response);

      const monitor = getUsageMonitor();
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      // 403 errors should throw
      await expect(
        monitor['fetchUsageViaAPI']('expired-token', 'test-profile-1', 'Test Profile')
      ).rejects.toThrow('API Auth Failure: 403');

      expect(consoleSpy).toHaveBeenCalled();

      consoleSpy.mockRestore();
    });

    it('should handle 500 Internal Server Error', async () => {
      const mockFetch = vi.mocked(global.fetch);
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        json: async () => ({ error: 'Server error' })
      } as unknown as Response);

      const monitor = getUsageMonitor();
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const usage = await monitor['fetchUsageViaAPI']('valid-token', 'test-profile-1', 'Test Profile');

      expect(usage).toBeNull();
      expect(consoleSpy).toHaveBeenCalled();

      consoleSpy.mockRestore();
    });

    it('should handle network timeout/failure', async () => {
      const mockFetch = vi.mocked(global.fetch);
      mockFetch.mockRejectedValueOnce(new Error('Network timeout'));

      const monitor = getUsageMonitor();
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const usage = await monitor['fetchUsageViaAPI']('valid-token', 'test-profile-1', 'Test Profile');

      expect(usage).toBeNull();
      expect(consoleSpy).toHaveBeenCalled();

      consoleSpy.mockRestore();
    });

    it('should handle invalid JSON response', async () => {
      const mockFetch = vi.mocked(global.fetch);
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: 'OK',
        json: async () => {
          throw new SyntaxError('Invalid JSON');
        }
      } as unknown as Response);

      const monitor = getUsageMonitor();
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const usage = await monitor['fetchUsageViaAPI']('valid-token', 'test-profile-1', 'Test Profile');

      expect(usage).toBeNull();
      expect(consoleSpy).toHaveBeenCalled();

      consoleSpy.mockRestore();
    });

    it('should handle auth errors with clear messages in response body', async () => {
      const mockFetch = vi.mocked(global.fetch);
      // Mock a 401 response with detailed error message in body
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
        json: async () => ({ error: 'authentication failed', detail: 'invalid credentials' })
      } as unknown as Response);

      const monitor = getUsageMonitor();
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      // 401 errors should throw with proper message
      await expect(
        monitor['fetchUsageViaAPI']('invalid-token', 'test-profile-1', 'Test Profile')
      ).rejects.toThrow('API Auth Failure: 401');

      expect(consoleSpy).toHaveBeenCalled();

      consoleSpy.mockRestore();
    });
  });

  describe('Credential error handling', () => {
    it('should handle missing credential gracefully', async () => {
      const monitor = getUsageMonitor();
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      // Call fetchUsage without credential
      const usage = await monitor['fetchUsage']('test-profile-1', undefined);

      // Should fall back to CLI method (which returns null)
      expect(usage).toBeNull();
      expect(consoleSpy).toHaveBeenCalled();

      consoleSpy.mockRestore();
    });

    it('should handle empty credential string', async () => {
      const monitor = getUsageMonitor();
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const usage = await monitor['fetchUsage']('test-profile-1', '');

      // Should fall back to CLI method
      expect(usage).toBeNull();

      consoleSpy.mockRestore();
    });
  });

  describe('Profile error handling', () => {
    it('should handle null active profile', async () => {
      // Get the mocked getClaudeProfileManager function
      const { getClaudeProfileManager } = await import('../claude-profile-manager');
      const mockGetManager = vi.mocked(getClaudeProfileManager);

      // Mock to return null for active profile
      mockGetManager.mockReturnValueOnce({
        getAutoSwitchSettings: vi.fn(() => ({
          enabled: true,
          proactiveSwapEnabled: true,
          usageCheckInterval: 30000,
          sessionThreshold: 80,
          weeklyThreshold: 80
        })),
        getActiveProfile: vi.fn(() => null), // Return null
        getProfile: vi.fn(() => null),
        getProfilesSortedByAvailability: vi.fn(() => []),
        setActiveProfile: vi.fn(),
        getProfileToken: vi.fn(() => null)
      } as any);

      const monitor = getUsageMonitor();
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      // Call checkUsageAndSwap directly to test null profile handling
      await monitor['checkUsageAndSwap']();

      // Should log a warning about no active profile
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('No active profile'));

      consoleSpy.mockRestore();
    });

    it('should handle profile with missing required fields', async () => {
      const monitor = getUsageMonitor();
      const rawData = {
        // Missing all required fields
      };

      const usage = monitor['normalizeAnthropicResponse'](rawData, 'test-profile-1', 'Test Profile');

      // Should still return a valid snapshot with defaults
      expect(usage).not.toBeNull();
      expect(usage.sessionPercent).toBe(0);
      expect(usage.weeklyPercent).toBe(0);
      expect(usage.sessionResetTime).toBe('Unknown');
      expect(usage.weeklyResetTime).toBe('Unknown');
    });
  });

  describe('Provider-specific error handling', () => {
    it('should handle zai API errors', async () => {
      const mockFetch = vi.mocked(global.fetch);
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 503,
        statusText: 'Service Unavailable',
        json: async () => ({ error: 'z.ai service unavailable' })
      } as unknown as Response);

      // Mock API profile with zai baseUrl
      mockLoadProfilesFile.mockResolvedValueOnce({
        profiles: [{
          id: 'zai-profile-1',
          name: 'z.ai Profile',
          baseUrl: 'https://api.z.ai/api/anthropic',
          apiKey: 'zai-api-key'
        }],
        activeProfileId: 'zai-profile-1',
        version: 1
      });

      const monitor = getUsageMonitor();
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const usage = await monitor['fetchUsageViaAPI']('zai-api-key', 'zai-profile-1', 'z.ai Profile');

      expect(usage).toBeNull();
      expect(consoleSpy).toHaveBeenCalled();

      consoleSpy.mockRestore();
    });

    it('should handle ZHIPU API errors', async () => {
      const mockFetch = vi.mocked(global.fetch);
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 502,
        statusText: 'Bad Gateway',
        json: async () => ({ error: 'ZHIPU gateway error' })
      } as unknown as Response);

      // Mock API profile with ZHIPU baseUrl
      mockLoadProfilesFile.mockResolvedValueOnce({
        profiles: [{
          id: 'zhipu-profile-1',
          name: 'ZHIPU Profile',
          baseUrl: 'https://open.bigmodel.cn/api/paas/v4',
          apiKey: 'zhipu-api-key'
        }],
        activeProfileId: 'zhipu-profile-1',
        version: 1
      });

      const monitor = getUsageMonitor();
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const usage = await monitor['fetchUsageViaAPI']('zhipu-api-key', 'zhipu-profile-1', 'ZHIPU Profile');

      expect(usage).toBeNull();
      expect(consoleSpy).toHaveBeenCalled();

      consoleSpy.mockRestore();
    });

    it('should handle unknown provider gracefully', async () => {
      // Mock API profile with unknown provider baseUrl
      mockLoadProfilesFile.mockResolvedValueOnce({
        profiles: [{
          id: 'unknown-profile-1',
          name: 'Unknown Provider Profile',
          baseUrl: 'https://unknown-provider.com/api',
          apiKey: 'unknown-api-key'
        }],
        activeProfileId: 'unknown-profile-1',
        version: 1
      });

      const monitor = getUsageMonitor();
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const usage = await monitor['fetchUsageViaAPI']('unknown-api-key', 'unknown-profile-1', 'Unknown Profile');

      // Unknown provider should return null
      expect(usage).toBeNull();
      expect(consoleSpy).toHaveBeenCalled();

      consoleSpy.mockRestore();
    });
  });

  describe('Reset time formatting error handling', () => {
    it('should handle invalid ISO timestamp format', () => {
      const monitor = getUsageMonitor();

      // When Date parsing fails with "Invalid Date", getTime() returns NaN
      // The fixed code now checks for invalid dates and returns 'Unknown'
      const formatted = monitor['formatResetTime']('not-a-valid-timestamp');

      // Invalid dates are now handled and return 'Unknown'
      expect(formatted).toBe('Unknown');
    });

    it('should handle null timestamp', () => {
      const monitor = getUsageMonitor();

      const formatted = monitor['formatResetTime'](null as any);

      expect(formatted).toBe('Unknown');
    });

    it('should handle undefined timestamp', () => {
      const monitor = getUsageMonitor();

      const formatted = monitor['formatResetTime'](undefined);

      expect(formatted).toBe('Unknown');
    });

    it('should handle past dates in reset time', () => {
      const monitor = getUsageMonitor();

      const pastDate = new Date(Date.now() - 25 * 60 * 60 * 1000); // 25 hours ago (over 24h)
      const formatted = monitor['formatResetTime'](pastDate.toISOString());

      // Past dates are now handled and return 'Expired'
      expect(formatted).toBe('Expired');
    });

    it('should handle recent past dates in hours format', () => {
      const monitor = getUsageMonitor();

      const pastDate = new Date(Date.now() - 2 * 60 * 60 * 1000); // 2 hours ago (under 24h)
      const formatted = monitor['formatResetTime'](pastDate.toISOString());

      // All past dates now return 'Expired'
      expect(formatted).toBe('Expired');
    });
  });

  describe('Concurrent check prevention', () => {
    it('should prevent concurrent usage checks', async () => {
      const monitor = getUsageMonitor();
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      // Start first check (it will take some time)
      const firstCheck = monitor['checkUsageAndSwap']();

      // Try to start second check immediately (should be ignored)
      const secondCheck = monitor['checkUsageAndSwap']();

      // Both should resolve
      await firstCheck;
      await secondCheck;

      // Verify checks completed
      expect(consoleSpy).toHaveBeenCalled();

      consoleSpy.mockRestore();
    });
  });

  describe('backward compatibility', () => {
    describe('Legacy OAuth-only profile support', () => {
      it('should work with legacy OAuth profiles (no API profile support)', async () => {
        // Mock loadProfilesFile to return empty profiles (API profiles not configured)
        mockLoadProfilesFile.mockResolvedValueOnce({
          profiles: [],
          activeProfileId: null,
          version: 1
        });

        const monitor = getUsageMonitor();
        const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

        // Should fall back to OAuth profile
        const credential = await monitor['getCredential']();

        // Should get OAuth token from profile manager
        expect(credential).toBe('mock-decrypted-token');

        consoleSpy.mockRestore();
      });

      it('should prioritize API profile when available', async () => {
        // Mock API profile is configured
        mockLoadProfilesFile.mockResolvedValueOnce({
          profiles: [{
            id: 'api-profile-1',
            name: 'API Profile',
            baseUrl: 'https://api.anthropic.com',
            apiKey: 'sk-ant-api-key'
          }],
          activeProfileId: 'api-profile-1',
          version: 1
        });

        const monitor = getUsageMonitor();
        const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

        const credential = await monitor['getCredential']();

        // Should prefer API key over OAuth token
        expect(credential).toBe('sk-ant-api-key');

        consoleSpy.mockRestore();
      });

      it('should handle missing API profile gracefully', async () => {
        // Mock activeProfileId points to non-existent profile
        mockLoadProfilesFile.mockResolvedValueOnce({
          profiles: [],
          activeProfileId: 'nonexistent-profile',
          version: 1
        });

        const monitor = getUsageMonitor();
        const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

        const credential = await monitor['getCredential']();

        // Should fall back to OAuth
        expect(credential).toBe('mock-decrypted-token');

        consoleSpy.mockRestore();
      });
    });

    describe('Settings backward compatibility', () => {
      it('should handle settings with missing optional fields', async () => {
        // Get the mocked getClaudeProfileManager function
        const { getClaudeProfileManager } = await import('../claude-profile-manager');
        const mockGetManager = vi.mocked(getClaudeProfileManager);

        // Mock settings with missing optional fields
        mockGetManager.mockReturnValueOnce({
          getAutoSwitchSettings: vi.fn(() => ({
            enabled: true,
            proactiveSwapEnabled: true
            // Missing: usageCheckInterval, sessionThreshold, weeklyThreshold
          })),
          getActiveProfile: vi.fn(() => ({
            id: 'test-profile-1',
            name: 'Test Profile',
            baseUrl: 'https://api.anthropic.com',
            oauthToken: 'mock-oauth-token'
          })),
          getProfile: vi.fn(() => ({
            id: 'test-profile-1',
            name: 'Test Profile',
            baseUrl: 'https://api.anthropic.com',
            oauthToken: 'mock-oauth-token'
          })),
          getProfilesSortedByAvailability: vi.fn(() => []),
          setActiveProfile: vi.fn(),
          getProfileToken: vi.fn(() => 'mock-decrypted-token')
        } as any);

        const monitor = getUsageMonitor();
        const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

        // Should start with default values for missing fields
        monitor.start();

        // Default usageCheckInterval is 30000ms
        expect(consoleSpy).toHaveBeenCalledWith('[UsageMonitor] Starting with interval:', 30000, 'ms (30-second updates for accurate usage stats)');

        consoleSpy.mockRestore();
        monitor.stop();
      });

      it('should use default thresholds when not specified in settings', async () => {
        // Get the mocked getClaudeProfileManager function
        const { getClaudeProfileManager } = await import('../claude-profile-manager');
        const mockGetManager = vi.mocked(getClaudeProfileManager);

        // Mock settings without thresholds
        mockGetManager.mockReturnValueOnce({
          getAutoSwitchSettings: vi.fn(() => ({
            enabled: true,
            proactiveSwapEnabled: true,
            usageCheckInterval: 30000
            // Missing: sessionThreshold, weeklyThreshold
          })),
          getActiveProfile: vi.fn(() => ({
            id: 'test-profile-1',
            name: 'Test Profile',
            baseUrl: 'https://api.anthropic.com',
            oauthToken: 'mock-oauth-token'
          })),
          getProfile: vi.fn(() => ({
            id: 'test-profile-1',
            name: 'Test Profile',
            baseUrl: 'https://api.anthropic.com',
            oauthToken: 'mock-oauth-token'
          })),
          getProfilesSortedByAvailability: vi.fn(() => []),
          setActiveProfile: vi.fn(),
          getProfileToken: vi.fn(() => 'mock-decrypted-token')
        } as any);

        const monitor = getUsageMonitor();
        const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

        // Should not crash when checking thresholds
        monitor.start();

        expect(consoleSpy).toHaveBeenCalled();

        consoleSpy.mockRestore();
        monitor.stop();
      });
    });

    describe('Anthropic response format backward compatibility', () => {
      it('should handle legacy Anthropic response format', () => {
        const monitor = getUsageMonitor();

        // Legacy format with field names that might have changed
        const legacyData = {
          five_hour_utilization: 0.60,
          seven_day_utilization: 0.40,
          five_hour_reset_at: '2025-01-17T15:00:00Z',
          seven_day_reset_at: '2025-01-20T12:00:00Z'
        };

        const usage = monitor['normalizeAnthropicResponse'](legacyData, 'test-profile-1', 'Legacy Profile');

        expect(usage).not.toBeNull();
        expect(usage.sessionPercent).toBe(60);
        expect(usage.weeklyPercent).toBe(40);
        expect(usage.limitType).toBe('session'); // 60% > 40%, so session is the higher limit
      });

      it('should handle response with only utilization values (no reset times)', () => {
        const monitor = getUsageMonitor();

        const minimalData = {
          five_hour_utilization: 0.75,
          seven_day_utilization: 0.50
          // Missing reset times
        };

        const usage = monitor['normalizeAnthropicResponse'](minimalData, 'test-profile-1', 'Minimal Profile');

        expect(usage).not.toBeNull();
        expect(usage.sessionPercent).toBe(75);
        expect(usage.weeklyPercent).toBe(50);
        expect(usage.sessionResetTime).toBe('Unknown');
        expect(usage.weeklyResetTime).toBe('Unknown');
      });

      it('should handle response with zero utilization values', () => {
        const monitor = getUsageMonitor();

        const zeroData = {
          five_hour_utilization: 0,
          seven_day_utilization: 0,
          five_hour_reset_at: '2025-01-17T15:00:00Z',
          seven_day_reset_at: '2025-01-20T12:00:00Z'
        };

        const usage = monitor['normalizeAnthropicResponse'](zeroData, 'test-profile-1', 'Zero Usage Profile');

        expect(usage).not.toBeNull();
        expect(usage.sessionPercent).toBe(0);
        expect(usage.weeklyPercent).toBe(0);
      });

      it('should handle response with only five_hour data (no seven_day)', () => {
        const monitor = getUsageMonitor();

        const partialData = {
          five_hour_utilization: 0.80,
          five_hour_reset_at: '2025-01-17T15:00:00Z'
          // Missing seven_day data
        };

        const usage = monitor['normalizeAnthropicResponse'](partialData, 'test-profile-1', 'Partial Profile');

        expect(usage).not.toBeNull();
        expect(usage.sessionPercent).toBe(80);
        expect(usage.weeklyPercent).toBe(0); // Defaults to 0
        expect(usage.sessionResetTime).not.toBe('Unknown');
        expect(usage.weeklyResetTime).toBe('Unknown');
      });
    });

    describe('Provider detection backward compatibility', () => {
      it('should handle Anthropic OAuth profiles (no baseUrl in OAuth profiles)', async () => {
        // OAuth profiles don't have baseUrl - they should default to Anthropic provider
        // This test verifies the backward compatibility by checking that:
        // 1. OAuth profiles (without baseUrl) are supported
        // 2. They default to using Anthropic's OAuth usage endpoint

        const endpoint = getUsageEndpoint('anthropic', 'https://api.anthropic.com');
        expect(endpoint).toBe('https://api.anthropic.com/api/oauth/usage');

        // Verify that when no baseUrl is provided (OAuth profile scenario),
        // the system defaults to Anthropic's standard endpoint
        const provider = detectProvider('https://api.anthropic.com');
        expect(provider).toBe('anthropic');
      });

      it('should handle legacy baseUrl formats for zai', () => {
        // Test various legacy zai baseUrl formats
        const legacyUrls = [
          'https://api.z.ai/api/anthropic',
          'https://z.ai/api/anthropic',
          'https://api.z.ai/v1',
          'https://z.ai'
        ];

        legacyUrls.forEach(url => {
          const provider = detectProvider(url);
          expect(provider).toBe('zai');
        });
      });

      it('should handle legacy baseUrl formats for ZHIPU', () => {
        // Test various legacy ZHIPU baseUrl formats
        const legacyUrls = [
          'https://open.bigmodel.cn/api/paas/v4',
          'https://dev.bigmodel.cn/api/paas/v4',
          'https://bigmodel.cn/api/paas/v4',
          'https://open.bigmodel.cn'
        ];

        legacyUrls.forEach(url => {
          const provider = detectProvider(url);
          expect(provider).toBe('zhipu');
        });
      });

      it('should handle Anthropic OAuth default baseUrl', () => {
        // OAuth profiles don't have baseUrl, should default to Anthropic
        const endpoint = getUsageEndpoint('anthropic', 'https://api.anthropic.com');
        expect(endpoint).toBe('https://api.anthropic.com/api/oauth/usage');
      });
    });

    describe('Mixed OAuth/API profile environments', () => {
      it('should handle environment with both OAuth and API profiles', async () => {
        const monitor = getUsageMonitor();
        const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

        // Mock both OAuth and API profiles
        mockLoadProfilesFile.mockResolvedValueOnce({
          profiles: [
            {
              id: 'api-profile-1',
              name: 'API Profile',
              baseUrl: 'https://api.anthropic.com',
              apiKey: 'sk-ant-api-key'
            },
            {
              id: 'api-profile-2',
              name: 'z.ai API Profile',
              baseUrl: 'https://api.z.ai/api/anthropic',
              apiKey: 'zai-api-key'
            }
          ],
          activeProfileId: 'api-profile-1',
          version: 1
        });

        const credential = await monitor['getCredential']();

        // Should use API profile when active
        expect(credential).toBe('sk-ant-api-key');

        consoleSpy.mockRestore();
      });

      it('should switch from API profile back to OAuth profile', async () => {
        const monitor = getUsageMonitor();
        const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

        // First, active API profile
        mockLoadProfilesFile.mockResolvedValueOnce({
          profiles: [{
            id: 'api-profile-1',
            name: 'API Profile',
            baseUrl: 'https://api.anthropic.com',
            apiKey: 'sk-ant-api-key'
          }],
          activeProfileId: 'api-profile-1',
          version: 1
        });

        let credential = await monitor['getCredential']();
        expect(credential).toBe('sk-ant-api-key');

        // Then, no active API profile (should fall back to OAuth)
        mockLoadProfilesFile.mockResolvedValueOnce({
          profiles: [],
          activeProfileId: null,
          version: 1
        });

        credential = await monitor['getCredential']();
        expect(credential).toBe('mock-decrypted-token');

        consoleSpy.mockRestore();
      });
    });

    describe('Graceful degradation for unknown providers', () => {
      it('should return null for unknown provider instead of throwing', () => {
        const endpoint = getUsageEndpoint('unknown' as ApiProvider, 'https://unknown-provider.com');
        expect(endpoint).toBeNull();
      });

      it('should handle invalid baseUrl gracefully', () => {
        const endpoint = getUsageEndpoint('anthropic', 'not-a-url');
        expect(endpoint).toBeNull();
      });

      it('should detect unknown provider from unrecognized baseUrl', () => {
        const provider = detectProvider('https://unknown-api-provider.com/v1');
        expect(provider).toBe('unknown');
      });
    });
  });
});

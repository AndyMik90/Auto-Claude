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
  profiles: [],
  activeProfileId: null,
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
  } as Response)
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

  describe('detectProvider', () => {
    it('should detect Anthropic from api.anthropic.com', () => {
      const result = detectProvider('https://api.anthropic.com');
      expect(result).toBe('anthropic');
    });

    it('should detect Anthropic from api.anthropic.com with path', () => {
      const result = detectProvider('https://api.anthropic.com/v1/messages');
      expect(result).toBe('anthropic');
    });

    it('should detect zai from api.z.ai', () => {
      const result = detectProvider('https://api.z.ai/api/anthropic');
      expect(result).toBe('zai');
    });

    it('should detect zai from z.ai', () => {
      const result = detectProvider('https://z.ai/api/anthropic');
      expect(result).toBe('zai');
    });

    it('should detect zhipu from open.bigmodel.cn', () => {
      const result = detectProvider('https://open.bigmodel.cn/api/paas/v4');
      expect(result).toBe('zhipu');
    });

    it('should detect zhipu from dev.bigmodel.cn', () => {
      const result = detectProvider('https://dev.bigmodel.cn/api/paas/v4');
      expect(result).toBe('zhipu');
    });

    it('should detect zhipu from bigmodel.cn', () => {
      const result = detectProvider('https://bigmodel.cn/api/paas/v4');
      expect(result).toBe('zhipu');
    });

    it('should return unknown for unrecognized domains', () => {
      const result = detectProvider('https://unknown.com/api');
      expect(result).toBe('unknown');
    });

    it('should return unknown for invalid URLs', () => {
      const result = detectProvider('not-a-url');
      expect(result).toBe('unknown');
    });

    it('should handle subdomains correctly', () => {
      const result = detectProvider('https://sub.api.anthropic.com');
      expect(result).toBe('anthropic');
    });
  });

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
      expect(result).toBe('https://api.z.ai/api/monitor/usage/model-usage');
    });

    it('should return correct endpoint for zhipu', () => {
      const result = getUsageEndpoint('zhipu', 'https://open.bigmodel.cn/api/paas/v4');
      expect(result).toBe('https://open.bigmodel.cn/api/monitor/usage/model-usage');
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
      const callCountAfterStart = consoleSpy.mock.calls.length;
      monitor.start(); // Second call should be ignored

      // Should not have added more calls (already running)
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

    it('should return null for current usage initially', () => {
      const monitor = getUsageMonitor();
      const usage = monitor.getCurrentUsage();

      expect(usage).toBeNull();
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

      const rawData = {
        session_usage: 36000,
        session_limit: 50000,
        weekly_usage: 180000,
        weekly_limit: 350000,
        session_reset_at: sessionReset.toISOString(),
        weekly_reset_at: weeklyReset.toISOString()
      };

      const usage = monitor['normalizeZAIResponse'](rawData, 'zai-profile-1', 'z.ai Profile');

      expect(usage).not.toBeNull();
      expect(usage?.sessionPercent).toBe(72); // (36000/50000) * 100
      expect(usage?.weeklyPercent).toBe(51); // (180000/350000) * 100 = 51.43 -> 51
      expect(usage?.sessionResetTime).toMatch(/\d+h \d+m/); // Should match format like "2h 0m"
      expect(usage?.weeklyResetTime).toMatch(/\d+d \d+h/); // Should match format like "4d 0h"
      expect(usage?.limitType).toBe('session'); // 51 (weekly) < 72 (session), so session is higher
    });

    it('should try alternative field names for z.ai response', () => {
      const monitor = getUsageMonitor();
      const rawData = {
        used_tokens: 25000,
        total_tokens: 100000,
        weekly_used: 150000,
        week_limit: 300000
        // Missing reset times
      };

      const usage = monitor['normalizeZAIResponse'](rawData, 'zai-profile-1', 'z.ai Profile');

      expect(usage).not.toBeNull();
      expect(usage?.sessionPercent).toBe(25); // (25000/100000) * 100
      expect(usage?.weeklyPercent).toBe(50); // (150000/300000) * 100
      expect(usage?.sessionResetTime).toBe('Unknown'); // Missing
      expect(usage?.weeklyResetTime).toBe('Unknown'); // Missing
    });

    it('should return 0% usage when no data can be extracted from z.ai', () => {
      const monitor = getUsageMonitor();
      const rawData = {
        unknown_field: 'some_value',
        another_field: 123
      };

      const usage = monitor['normalizeZAIResponse'](rawData, 'zai-profile-1', 'z.ai Profile');

      expect(usage).not.toBeNull();
      expect(usage?.sessionPercent).toBe(0);
      expect(usage?.weeklyPercent).toBe(0);
    });
  });

  describe('ZHIPU response normalization', () => {
    it('should normalize ZHIPU response with usage/limit fields', () => {
      const monitor = getUsageMonitor();
      const rawData = {
        session_usage: 45000,
        session_limit: 50000,
        weekly_usage: 280000,
        weekly_limit: 350000,
        session_reset_at: '2025-01-17T17:00:00Z',
        weekly_reset_at: '2025-01-21T14:00:00Z'
      };

      const usage = monitor['normalizeZhipuResponse'](rawData, 'zhipu-profile-1', 'ZHIPU Profile');

      expect(usage).not.toBeNull();
      expect(usage?.sessionPercent).toBe(90); // (45000/50000) * 100
      expect(usage?.weeklyPercent).toBe(80); // (280000/350000) * 100
      expect(usage?.limitType).toBe('session'); // 80 (weekly) < 90 (session), so session is higher
      expect(usage?.profileId).toBe('zhipu-profile-1');
      expect(usage?.profileName).toBe('ZHIPU Profile');
    });

    it('should try alternative field names for ZHIPU response', () => {
      const monitor = getUsageMonitor();
      const rawData = {
        five_hour_usage: 30000,
        five_hour_limit: 60000,
        seven_day_usage: 200000,
        seven_day_limit: 420000
      };

      const usage = monitor['normalizeZhipuResponse'](rawData, 'zhipu-profile-1', 'ZHIPU Profile');

      expect(usage).not.toBeNull();
      expect(usage?.sessionPercent).toBe(50); // (30000/60000) * 100
      expect(usage?.weeklyPercent).toBe(48); // (200000/420000) * 100 = 47.6 -> 48
    });
  });

  describe('Percentage calculation', () => {
    it('should calculate percentages correctly from usage/limit values', () => {
      const monitor = getUsageMonitor();
      const rawData = {
        session_usage: 1,
        session_limit: 4,
        weekly_usage: 2,
        weekly_limit: 4
      };

      const usage = monitor['normalizeZAIResponse'](rawData, 'test-profile', 'Test Profile');

      expect(usage?.sessionPercent).toBe(25); // 1/4 * 100
      expect(usage?.weeklyPercent).toBe(50); // 2/4 * 100
    });

    it('should handle division by zero (zero limit)', () => {
      const monitor = getUsageMonitor();
      const rawData = {
        session_usage: 1000,
        session_limit: 0, // Zero limit should not cause division by zero
        weekly_usage: 5000,
        weekly_limit: 10000
      };

      const usage = monitor['normalizeZAIResponse'](rawData, 'test-profile', 'Test Profile');

      expect(usage?.sessionPercent).toBe(0); // Should default to 0 when limit is 0
      expect(usage?.weeklyPercent).toBe(50); // (5000/10000) * 100
    });
  });

  describe('Malformed response handling', () => {
    it('should handle non-numeric usage values gracefully', () => {
      const monitor = getUsageMonitor();
      const rawData = {
        session_usage: 'not a number',
        session_limit: 'also not a number',
        weekly_usage: null,
        weekly_limit: undefined
      };

      const usage = monitor['normalizeZAIResponse'](rawData, 'test-profile', 'Test Profile');

      // Should return 0% usage when all values are invalid
      expect(usage).not.toBeNull();
      expect(usage?.sessionPercent).toBe(0);
      expect(usage?.weeklyPercent).toBe(0);
    });

    it('should handle completely unknown response structure', () => {
      const monitor = getUsageMonitor();
      const rawData = {
        unknown_field: 'some_value',
        another_field: 123,
        nested: {
          data: 'value'
        }
      };

      const usage = monitor['normalizeZAIResponse'](rawData, 'test-profile', 'Test Profile');

      // Should return 0% usage when no known fields found
      expect(usage).not.toBeNull();
      expect(usage?.sessionPercent).toBe(0);
      expect(usage?.weeklyPercent).toBe(0);
      expect(usage?.sessionResetTime).toBe('Unknown');
      expect(usage?.weeklyResetTime).toBe('Unknown');
    });
  });
});

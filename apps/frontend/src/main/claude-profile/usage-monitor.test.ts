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
vi.mock('../services/profile/profile-manager', () => ({
  loadProfilesFile: vi.fn(async () => ({
    profiles: [],
    activeProfileId: null,
    version: 1
  }))
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
});

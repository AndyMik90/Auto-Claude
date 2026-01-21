/**
 * @vitest-environment jsdom
 */

/**
 * Unit tests for os-detection utility
 * Tests OS detection functions for Windows, macOS, and Linux
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('os-detection', () => {
  let getOS: typeof import('../os-detection').getOS;
  let isWindows: typeof import('../os-detection').isWindows;
  let isMacOS: typeof import('../os-detection').isMacOS;
  let isLinux: typeof import('../os-detection').isLinux;

  const originalPlatform = process.platform;

  beforeEach(async () => {
    vi.resetModules();

    // Import fresh module
    const osModule = await import('../os-detection');
    getOS = osModule.getOS;
    isWindows = osModule.isWindows;
    isMacOS = osModule.isMacOS;
    isLinux = osModule.isLinux;
  });

  afterEach(() => {
    // Restore original process.platform
    Object.defineProperty(process, 'platform', {
      value: originalPlatform,
    });
  });

  describe('getOS', () => {
    it('should return "windows" on Windows platform', () => {
      Object.defineProperty(process, 'platform', {
        value: 'win32',
      });

      expect(getOS()).toBe('windows');
    });

    it('should return "macos" on macOS platform', () => {
      Object.defineProperty(process, 'platform', {
        value: 'darwin',
      });

      expect(getOS()).toBe('macos');
    });

    it('should return "linux" on Linux platform', () => {
      Object.defineProperty(process, 'platform', {
        value: 'linux',
      });

      expect(getOS()).toBe('linux');
    });

    it('should return "linux" as fallback for unknown platforms', () => {
      Object.defineProperty(process, 'platform', {
        value: 'freebsd',
      });

      expect(getOS()).toBe('linux');
    });
  });

  describe('isWindows', () => {
    it('should return true on Windows platform', () => {
      Object.defineProperty(process, 'platform', {
        value: 'win32',
      });

      expect(isWindows()).toBe(true);
    });

    it('should return false on macOS platform', () => {
      Object.defineProperty(process, 'platform', {
        value: 'darwin',
      });

      expect(isWindows()).toBe(false);
    });

    it('should return false on Linux platform', () => {
      Object.defineProperty(process, 'platform', {
        value: 'linux',
      });

      expect(isWindows()).toBe(false);
    });
  });

  describe('isMacOS', () => {
    it('should return false on Windows platform', () => {
      Object.defineProperty(process, 'platform', {
        value: 'win32',
      });

      expect(isMacOS()).toBe(false);
    });

    it('should return true on macOS platform', () => {
      Object.defineProperty(process, 'platform', {
        value: 'darwin',
      });

      expect(isMacOS()).toBe(true);
    });

    it('should return false on Linux platform', () => {
      Object.defineProperty(process, 'platform', {
        value: 'linux',
      });

      expect(isMacOS()).toBe(false);
    });
  });

  describe('isLinux', () => {
    it('should return false on Windows platform', () => {
      Object.defineProperty(process, 'platform', {
        value: 'win32',
      });

      expect(isLinux()).toBe(false);
    });

    it('should return false on macOS platform', () => {
      Object.defineProperty(process, 'platform', {
        value: 'darwin',
      });

      expect(isLinux()).toBe(false);
    });

    it('should return true on Linux platform', () => {
      Object.defineProperty(process, 'platform', {
        value: 'linux',
      });

      expect(isLinux()).toBe(true);
    });
  });

  describe('OS detection consistency', () => {
    it('should only return true for one OS function at a time', () => {
      const platforms = ['win32', 'darwin', 'linux'] as const;

      for (const platform of platforms) {
        Object.defineProperty(process, 'platform', {
          value: platform,
        });

        const results = [isWindows(), isMacOS(), isLinux()].filter(Boolean);
        expect(results.length).toBe(1);
      }
    });
  });
});

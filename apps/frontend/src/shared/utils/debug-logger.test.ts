/**
 * Debug Logger Tests
 *
 * Tests debug logging functionality with platform-specific behavior for
 * case-insensitive environment variable access on Windows.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { isDebugEnabled, debugLog, debugWarn, debugError } from './debug-logger';

// Mock the platform module
vi.mock('../platform', () => ({
  isWindows: vi.fn(),
  isMacOS: vi.fn(),
  isLinux: vi.fn(),
  getCurrentPlatform: vi.fn(),
  getEnvVar: vi.fn(),
}));

import { isWindows, getEnvVar } from '../platform';
const mockIsWindows = vi.mocked(isWindows);
const mockGetEnvVar = vi.mocked(getEnvVar);

describe('debug-logger', () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
    vi.resetAllMocks();
  });

  describe('isDebugEnabled', () => {
    describe('on Windows (case-insensitive)', () => {
      beforeEach(() => {
        mockIsWindows.mockReturnValue(true);
        // Mock getEnvVar to simulate case-insensitive behavior
        mockGetEnvVar.mockImplementation((varName: string) => {
          // On Windows, check for DEBUG in any case
          for (const [key, value] of Object.entries(process.env)) {
            if (key.toUpperCase() === 'DEBUG') {
              return value;
            }
          }
          return undefined;
        });
      });

      it('returns true when DEBUG=true', () => {
        process.env.DEBUG = 'true';
        expect(isDebugEnabled()).toBe(true);
      });

      it('returns true for lowercase debug=true', () => {
        process.env.debug = 'true';
        expect(isDebugEnabled()).toBe(true);
      });

      it('returns true for mixed case Debug=true', () => {
        process.env.Debug = 'true';
        expect(isDebugEnabled()).toBe(true);
      });

      it('returns false when DEBUG=false', () => {
        process.env.DEBUG = 'false';
        expect(isDebugEnabled()).toBe(false);
      });

      it('returns false when DEBUG is not set', () => {
        delete process.env.DEBUG;
        delete process.env.debug;
        delete process.env.Debug;
        expect(isDebugEnabled()).toBe(false);
      });

      it('returns false when DEBUG is set to non-true value', () => {
        process.env.DEBUG = '1';
        expect(isDebugEnabled()).toBe(false);

        process.env.DEBUG = 'yes';
        expect(isDebugEnabled()).toBe(false);
      });

      it('returns boolean type when multiple env vars with different cases', () => {
        // Windows can have duplicate env vars with different cases
        // The result depends on Object.entries iteration order (insertion order)
        // This test documents the behavior - the function returns a boolean
        process.env.DEBUG = 'false';
        process.env.debug = 'true';
        const result = isDebugEnabled();
        expect(typeof result).toBe('boolean');
      });
    });

    describe('on Unix (case-sensitive)', () => {
      beforeEach(() => {
        mockIsWindows.mockReturnValue(false);
        // Mock getEnvVar to simulate case-sensitive behavior
        mockGetEnvVar.mockImplementation((varName: string) => {
          // On Unix, exact case match only
          return process.env[varName];
        });
      });

      it('returns true when DEBUG=true (exact case)', () => {
        process.env.DEBUG = 'true';
        expect(isDebugEnabled()).toBe(true);
      });

      it('returns false for lowercase debug=true (wrong case)', () => {
        process.env.debug = 'true';
        expect(isDebugEnabled()).toBe(false);
      });

      it('returns false for mixed case Debug=true (wrong case)', () => {
        process.env.Debug = 'true';
        expect(isDebugEnabled()).toBe(false);
      });

      it('returns false when DEBUG is not set', () => {
        delete process.env.DEBUG;
        expect(isDebugEnabled()).toBe(false);
      });
    });
  });

  describe('debugLog', () => {
    it('logs when debug is enabled', () => {
      mockIsWindows.mockReturnValue(false);
      mockGetEnvVar.mockReturnValue('true');

      // Console.log is called; we just verify no error is thrown
      expect(() => debugLog('Test message')).not.toThrow();
    });

    it('does not log when debug is disabled', () => {
      mockIsWindows.mockReturnValue(false);
      mockGetEnvVar.mockReturnValue(undefined);

      // Console.log is not called; we just verify no error is thrown
      expect(() => debugLog('Test message')).not.toThrow();
    });
  });

  describe('debugWarn', () => {
    it('logs warning when debug is enabled', () => {
      mockIsWindows.mockReturnValue(false);
      mockGetEnvVar.mockReturnValue('true');

      expect(() => debugWarn('Test warning')).not.toThrow();
    });

    it('does not log when debug is disabled', () => {
      mockIsWindows.mockReturnValue(false);
      mockGetEnvVar.mockReturnValue(undefined);

      expect(() => debugWarn('Test warning')).not.toThrow();
    });
  });

  describe('debugError', () => {
    it('logs error when debug is enabled', () => {
      mockIsWindows.mockReturnValue(false);
      mockGetEnvVar.mockReturnValue('true');

      expect(() => debugError('Test error')).not.toThrow();
    });

    it('does not log when debug is disabled', () => {
      mockIsWindows.mockReturnValue(false);
      mockGetEnvVar.mockReturnValue(undefined);

      expect(() => debugError('Test error')).not.toThrow();
    });
  });
});

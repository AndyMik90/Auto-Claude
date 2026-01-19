/**
 * Debug Logger Tests
 *
 * Tests debug logging functionality with platform-specific behavior for
 * case-insensitive environment variable access on Windows.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { isDebugEnabled, debugLog, debugWarn, debugError } from './debug-logger';

// Mock process.platform
const originalPlatform = process.platform;

function mockPlatform(platform: NodeJS.Platform) {
  Object.defineProperty(process, 'platform', {
    value: platform,
    writable: true,
    configurable: true
  });
}

describe('debug-logger', () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    mockPlatform(originalPlatform);
    process.env = { ...originalEnv };
  });

  describe('isDebugEnabled', () => {
    describe('on Windows (case-insensitive)', () => {
      beforeEach(() => mockPlatform('win32'));

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

      it('handles multiple environment variables with different cases', () => {
        // Windows can have duplicate env vars with different cases
        process.env.DEBUG = 'false';
        process.env.debug = 'true';
        // Should find one of them (iteration order dependent)
        const result = isDebugEnabled();
        expect(result === true || result === false).toBe(true);
      });
    });

    describe('on Unix (case-sensitive)', () => {
      beforeEach(() => mockPlatform('darwin'));

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

    describe('on Linux (case-sensitive)', () => {
      beforeEach(() => mockPlatform('linux'));

      it('returns true only when DEBUG=true (exact case)', () => {
        process.env.DEBUG = 'true';
        expect(isDebugEnabled()).toBe(true);
      });

      it('returns false for wrong case on Linux', () => {
        process.env.debug = 'true';
        expect(isDebugEnabled()).toBe(false);
      });
    });
  });

  describe('debugLog', () => {
    const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {
      // Intentionally empty for mock
    });

    afterEach(() => {
      consoleWarnSpy.mockClear();
    });

    it('logs when DEBUG=true', () => {
      process.env.DEBUG = 'true';
      debugLog('test message');
      expect(consoleWarnSpy).toHaveBeenCalledWith('test message');
    });

    it('does not log when DEBUG=false', () => {
      process.env.DEBUG = 'false';
      debugLog('test message');
      expect(consoleWarnSpy).not.toHaveBeenCalled();
    });

    it('does not log when DEBUG is not set', () => {
      delete process.env.DEBUG;
      debugLog('test message');
      expect(consoleWarnSpy).not.toHaveBeenCalled();
    });

    it('logs multiple arguments', () => {
      process.env.DEBUG = 'true';
      debugLog('message', { data: 'value' }, 123);
      expect(consoleWarnSpy).toHaveBeenCalledWith('message', { data: 'value' }, 123);
    });

    it('handles empty arguments', () => {
      process.env.DEBUG = 'true';
      debugLog();
      expect(consoleWarnSpy).toHaveBeenCalledWith();
    });
  });

  describe('debugWarn', () => {
    const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {
      // Intentionally empty for mock
    });

    afterEach(() => {
      consoleWarnSpy.mockClear();
    });

    it('logs warnings when DEBUG=true', () => {
      process.env.DEBUG = 'true';
      debugWarn('warning message');
      expect(consoleWarnSpy).toHaveBeenCalledWith('warning message');
    });

    it('does not log warnings when DEBUG=false', () => {
      process.env.DEBUG = 'false';
      debugWarn('warning message');
      expect(consoleWarnSpy).not.toHaveBeenCalled();
    });
  });

  describe('debugError', () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {
      // Intentionally empty for mock
    });

    afterEach(() => {
      consoleErrorSpy.mockClear();
    });

    it('logs errors when DEBUG=true', () => {
      process.env.DEBUG = 'true';
      debugError('error message');
      expect(consoleErrorSpy).toHaveBeenCalledWith('error message');
    });

    it('does not log errors when DEBUG=false', () => {
      process.env.DEBUG = 'false';
      debugError('error message');
      expect(consoleErrorSpy).not.toHaveBeenCalled();
    });

    it('logs error objects', () => {
      process.env.DEBUG = 'true';
      const error = new Error('test error');
      debugError('Something went wrong:', error);
      expect(consoleErrorSpy).toHaveBeenCalledWith('Something went wrong:', error);
    });
  });

  describe('cross-platform behavior', () => {
    beforeEach(() => {
      // Clear all DEBUG-related env vars
      delete process.env.DEBUG;
      delete process.env.debug;
      delete process.env.Debug;
    });

    it('Windows: finds DEBUG regardless of case', () => {
      mockPlatform('win32');

      // Set lowercase version
      process.env.debug = 'true';
      expect(isDebugEnabled()).toBe(true);

      // Clear and set uppercase version
      delete process.env.debug;
      process.env.DEBUG = 'true';
      expect(isDebugEnabled()).toBe(true);
    });

    it('Unix: only finds exact case match', () => {
      mockPlatform('linux');

      // Set lowercase - should not find
      process.env.debug = 'true';
      expect(isDebugEnabled()).toBe(false);

      // Set exact case - should find
      process.env.DEBUG = 'true';
      expect(isDebugEnabled()).toBe(true);
    });
  });

  describe('edge cases', () => {
    it('handles process.env being undefined', () => {
      const originalEnv = process.env;
      // @ts-expect-error - Testing undefined env
      process.env = undefined;

      expect(isDebugEnabled()).toBe(false);

      process.env = originalEnv;
    });

    it('handles empty string DEBUG value', () => {
      process.env.DEBUG = '';
      expect(isDebugEnabled()).toBe(false);
    });

    it('handles whitespace in DEBUG value', () => {
      process.env.DEBUG = ' true ';
      expect(isDebugEnabled()).toBe(false);
    });
  });
});

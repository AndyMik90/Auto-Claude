/**
 * Shared Platform Module Tests
 *
 * Tests the shared platform abstraction layer that is used by
 * both main process and renderer process code.
 */

import { describe, it, expect, afterEach, beforeEach } from 'vitest';
import {
  getCurrentPlatform,
  isWindows,
  isMacOS,
  isLinux,
  isUnix,
} from './platform';

// Mock process.platform
const originalPlatform = process.platform;

function mockPlatform(platform: NodeJS.Platform) {
  Object.defineProperty(process, 'platform', {
    value: platform,
    writable: true,
    configurable: true
  });
}

/**
 * Test helper: Describes a test suite that runs on Windows platform
 */
function describeWindows(title: string, fn: () => void): void {
  describe(title, () => {
    beforeEach(() => mockPlatform('win32'));
    fn();
  });
}

/**
 * Test helper: Describes a test suite that runs on macOS platform
 */
function describeMacOS(title: string, fn: () => void): void {
  describe(title, () => {
    beforeEach(() => mockPlatform('darwin'));
    fn();
  });
}

/**
 * Test helper: Describes a test suite that runs on Linux platform
 */
function describeLinux(title: string, fn: () => void): void {
  describe(title, () => {
    beforeEach(() => mockPlatform('linux'));
    fn();
  });
}

/**
 * Test helper: Describes a test suite that runs on both macOS and Linux
 */
function describeUnix(title: string, fn: (platform: 'darwin' | 'linux') => void) {
  describe(title, () => {
    describe('on macOS', () => {
      beforeEach(() => mockPlatform('darwin'));
      fn('darwin');
    });

    describe('on Linux', () => {
      beforeEach(() => mockPlatform('linux'));
      fn('linux');
    });
  });
}

describe('shared/platform', () => {
  afterEach(() => {
    mockPlatform(originalPlatform);
  });

  describe('getCurrentPlatform', () => {
    it('returns win32 on Windows', () => {
      mockPlatform('win32');
      expect(getCurrentPlatform()).toBe('win32');
    });

    it('returns darwin on macOS', () => {
      mockPlatform('darwin');
      expect(getCurrentPlatform()).toBe('darwin');
    });

    it('returns linux on Linux', () => {
      mockPlatform('linux');
      expect(getCurrentPlatform()).toBe('linux');
    });

    it('returns unknown for unsupported platforms', () => {
      mockPlatform('freebsd' as NodeJS.Platform);
      expect(getCurrentPlatform()).toBe('unknown');

      mockPlatform('aix' as NodeJS.Platform);
      expect(getCurrentPlatform()).toBe('unknown');

      mockPlatform('openbsd' as NodeJS.Platform);
      expect(getCurrentPlatform()).toBe('unknown');
    });

    it('returns a valid Platform type', () => {
      mockPlatform('win32');
      const result = getCurrentPlatform();
      expect(['win32', 'darwin', 'linux', 'unknown']).toContain(result);
    });
  });

  describe('isWindows', () => {
    describeWindows('returns true on Windows', () => {
      it('returns true', () => {
        expect(isWindows()).toBe(true);
      });
    });

    describeMacOS('returns false on macOS', () => {
      it('returns false', () => {
        expect(isWindows()).toBe(false);
      });
    });

    describeLinux('returns false on Linux', () => {
      it('returns false', () => {
        expect(isWindows()).toBe(false);
      });
    });
  });

  describe('isMacOS', () => {
    describeWindows('returns false on Windows', () => {
      it('returns false', () => {
        expect(isMacOS()).toBe(false);
      });
    });

    describeMacOS('returns true on macOS', () => {
      it('returns true', () => {
        expect(isMacOS()).toBe(true);
      });
    });

    describeLinux('returns false on Linux', () => {
      it('returns false', () => {
        expect(isMacOS()).toBe(false);
      });
    });
  });

  describe('isLinux', () => {
    describeWindows('returns false on Windows', () => {
      it('returns false', () => {
        expect(isLinux()).toBe(false);
      });
    });

    describeMacOS('returns false on macOS', () => {
      it('returns false', () => {
        expect(isLinux()).toBe(false);
      });
    });

    describeLinux('returns true on Linux', () => {
      it('returns true', () => {
        expect(isLinux()).toBe(true);
      });
    });
  });

  describe('isUnix', () => {
    describeWindows('returns false on Windows', () => {
      it('returns false', () => {
        expect(isUnix()).toBe(false);
      });
    });

    describeUnix('returns true on Unix platforms', () => {
      it('returns true', () => {
        expect(isUnix()).toBe(true);
      });
    });
  });

  describe('Platform Detection Integration', () => {
    it('only one platform function returns true at a time', () => {
      mockPlatform('win32');
      expect(isWindows() && !isMacOS() && !isLinux()).toBe(true);

      mockPlatform('darwin');
      expect(!isWindows() && isMacOS() && !isLinux()).toBe(true);

      mockPlatform('linux');
      expect(!isWindows() && !isMacOS() && isLinux()).toBe(true);
    });

    it('isUnix returns true for both macOS and Linux', () => {
      mockPlatform('darwin');
      expect(isUnix()).toBe(true);

      mockPlatform('linux');
      expect(isUnix()).toBe(true);
    });

    it('isUnix returns false for Windows', () => {
      mockPlatform('win32');
      expect(isUnix()).toBe(false);
    });
  });

  describe('Edge Cases', () => {
    it('handles unknown platform gracefully', () => {
      mockPlatform('freebsd' as NodeJS.Platform);
      expect(getCurrentPlatform()).toBe('unknown');
      expect(isWindows()).toBe(false);
      expect(isMacOS()).toBe(false);
      expect(isLinux()).toBe(false);
      expect(isUnix()).toBe(false);
    });

    it('returns consistent results across multiple calls', () => {
      mockPlatform('darwin');
      expect(getCurrentPlatform()).toBe('darwin');
      expect(getCurrentPlatform()).toBe('darwin');
      expect(getCurrentPlatform()).toBe('darwin');
    });
  });
});

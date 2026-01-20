/**
 * Homebrew Python Detection Tests
 *
 * Tests for finding Python installations in Homebrew directories.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { existsSync } from 'fs';

// Normalize path for cross-platform comparison
// Windows uses backslashes, tests expect forward slashes
function normalizePathForTest(p: string | null | undefined): string | null {
  if (!p) return null;
  return p.replace(/\\/g, '/');
}

// Mock existsSync
vi.mock('fs', () => ({
  existsSync: vi.fn()
}));

// Mock platform module to provide Homebrew paths for testing
vi.mock('../../platform', async () => {
  const actualPlatform = await vi.importActual<typeof import('../../platform')>('../../platform');
  const mockGetHomebrewBinPaths = vi.fn(() => [
    '/opt/homebrew/bin',  // Apple Silicon
    '/usr/local/bin'      // Intel Mac
  ]);
  return {
    ...actualPlatform,
    getHomebrewBinPaths: mockGetHomebrewBinPaths
  };
});

// Import after mock to ensure mock is applied
import { findHomebrewPython, type PythonValidation } from '../homebrew-python';
import { getHomebrewBinPaths } from '../../platform';

// Get reference to mocked function for resetting in beforeEach
const mockGetHomebrewBinPaths = vi.mocked(getHomebrewBinPaths);

describe('homebrew-python', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    // Re-configure getHomebrewBinPaths mock to ensure it returns the array
    // This is needed because vi.clearAllMocks() can affect mock implementations
    mockGetHomebrewBinPaths.mockImplementation(() => [
      '/opt/homebrew/bin',
      '/usr/local/bin'
    ]);
  });

  describe('findHomebrewPython', () => {
    const mockValidate = vi.fn();

    it('returns null when no Homebrew Python found', () => {
      vi.mocked(existsSync).mockReturnValue(false);

      const result = findHomebrewPython(mockValidate, '[Test]');

      expect(result).toBeNull();
      expect(existsSync).toHaveBeenCalledTimes(12); // 2 dirs * 6 python names
    });

    it('finds Python 3.14 in Apple Silicon directory', () => {
      vi.mocked(existsSync).mockImplementation((path) => {
        return path === '/opt/homebrew/bin/python3.14';
      });

      mockValidate.mockReturnValue({
        valid: true,
        version: '3.14.0',
        message: 'Valid'
      });

      const result = findHomebrewPython(mockValidate, '[Test]');

      expect(normalizePathForTest(result)).toBe('/opt/homebrew/bin/python3.14');
      expect(mockValidate).toHaveBeenCalledWith('/opt/homebrew/bin/python3.14');
    });

    it('finds Python 3.13 in Intel directory', () => {
      vi.mocked(existsSync).mockImplementation((path) => {
        return path === '/usr/local/bin/python3.13';
      });

      mockValidate.mockReturnValue({
        valid: true,
        version: '3.13.1',
        message: 'Valid'
      });

      const result = findHomebrewPython(mockValidate, '[Test]');

      expect(normalizePathForTest(result)).toBe('/usr/local/bin/python3.13');
    });

    it('prioritizes Apple Silicon over Intel directory', () => {
      vi.mocked(existsSync).mockImplementation((path) => {
        // Both have python3.12
        return path === '/opt/homebrew/bin/python3.12' ||
               path === '/usr/local/bin/python3.12';
      });

      mockValidate.mockReturnValue({
        valid: true,
        version: '3.12.0',
        message: 'Valid'
      });

      const result = findHomebrewPython(mockValidate, '[Test]');

      // Should return Apple Silicon path first
      expect(normalizePathForTest(result)).toBe('/opt/homebrew/bin/python3.12');
    });

    it('prioritizes newer Python versions', () => {
      // Apple Silicon directory with multiple versions
      vi.mocked(existsSync).mockImplementation((path) => {
        return [
          '/opt/homebrew/bin/python3.10',
          '/opt/homebrew/bin/python3.11',
          '/opt/homebrew/bin/python3.12',
          '/opt/homebrew/bin/python3.13',
          '/opt/homebrew/bin/python3.14'
        ].includes(path as string);
      });

      mockValidate.mockReturnValue({
        valid: true,
        version: '3.14.0',
        message: 'Valid'
      });

      const result = findHomebrewPython(mockValidate, '[Test]');

      // Should find python3.14 first (newest)
      expect(normalizePathForTest(result)).toBe('/opt/homebrew/bin/python3.14');
    });

    it('falls back to generic python3 when versioned not found', () => {
      vi.mocked(existsSync).mockImplementation((path) => {
        return path === '/opt/homebrew/bin/python3';
      });

      mockValidate.mockReturnValue({
        valid: true,
        version: '3.12.0',
        message: 'Valid'
      });

      const result = findHomebrewPython(mockValidate, '[Test]');

      expect(normalizePathForTest(result)).toBe('/opt/homebrew/bin/python3');
    });

    it('skips invalid Python versions', () => {
      // First version (3.14) exists but is invalid
      // Second version (3.13) exists and is valid
      vi.mocked(existsSync).mockImplementation((path) => {
        return [
          '/opt/homebrew/bin/python3.14',
          '/opt/homebrew/bin/python3.13'
        ].includes(path as string);
      });

      mockValidate.mockImplementation((path) => {
        if (path === '/opt/homebrew/bin/python3.14') {
          return { valid: false, message: 'Version too old' };
        }
        return { valid: true, version: '3.13.0', message: 'Valid' };
      });

      const result = findHomebrewPython(mockValidate, '[Test]');

      expect(normalizePathForTest(result)).toBe('/opt/homebrew/bin/python3.13');
      expect(mockValidate).toHaveBeenCalledTimes(2);
    });

    it('handles validation errors gracefully', () => {
      vi.mocked(existsSync).mockImplementation((path) => {
        return path === '/opt/homebrew/bin/python3.12';
      });

      mockValidate.mockImplementation(() => {
        throw new Error('Validation failed');
      });

      const result = findHomebrewPython(mockValidate, '[Test]');

      expect(result).toBeNull();
    });

    it('continues search after validation error', () => {
      // First Python (3.14) throws error
      // Second Python (3.13) is valid
      vi.mocked(existsSync).mockImplementation((path) => {
        return [
          '/opt/homebrew/bin/python3.14',
          '/opt/homebrew/bin/python3.13'
        ].includes(path as string);
      });

      mockValidate.mockImplementation((path) => {
        if (path === '/opt/homebrew/bin/python3.14') {
          throw new Error('Timeout');
        }
        return { valid: true, version: '3.13.0', message: 'Valid' };
      });

      const result = findHomebrewPython(mockValidate, '[Test]');

      expect(normalizePathForTest(result)).toBe('/opt/homebrew/bin/python3.13');
      expect(mockValidate).toHaveBeenCalledTimes(2);
    });

    it('checks Apple Silicon directory before Intel', () => {
      vi.mocked(existsSync).mockImplementation((path) => {
        // Apple Intel has python3.14
        return path === '/usr/local/bin/python3.14';
      });

      mockValidate.mockReturnValue({
        valid: true,
        version: '3.14.0',
        message: 'Valid'
      });

      const result = findHomebrewPython(mockValidate, '[Test]');

      // Should still find it, just later in the search
      expect(normalizePathForTest(result)).toBe('/usr/local/bin/python3.14');
    });

    describe('version priority order', () => {
      it('searches in correct order: 3.14, 3.13, 3.12, 3.11, 3.10, python3', () => {
        const searchOrder: string[] = [];
        const validateCalls: string[] = [];

        vi.mocked(existsSync).mockImplementation((path) => {
          const pathStr = path.toString();
          // Normalize to forward slashes for comparison (Windows produces backslashes)
          const normalized = pathStr.replace(/\\/g, '/');
          if (normalized.startsWith('/opt/homebrew/bin/') || normalized.startsWith('/usr/local/bin/')) {
            searchOrder.push(normalized);
          }
          return false; // No Python actually exists
        });

        mockValidate.mockImplementation((path) => {
          validateCalls.push(path);
          return { valid: false, message: 'Not found' };
        });

        findHomebrewPython(mockValidate, '[Test]');

        // All paths should be checked (no valid Python found)
        // Paths are normalized to forward slashes for cross-platform comparison
        expect(searchOrder).toEqual([
          '/opt/homebrew/bin/python3.14',
          '/opt/homebrew/bin/python3.13',
          '/opt/homebrew/bin/python3.12',
          '/opt/homebrew/bin/python3.11',
          '/opt/homebrew/bin/python3.10',
          '/opt/homebrew/bin/python3',
          '/usr/local/bin/python3.14',
          '/usr/local/bin/python3.13',
          '/usr/local/bin/python3.12',
          '/usr/local/bin/python3.11',
          '/usr/local/bin/python3.10',
          '/usr/local/bin/python3'
        ]);
      });

      it('stops searching after finding valid Python', () => {
        const validateCalls: string[] = [];

        // python3.14, 3.13 exist but invalid; python3.12 exists and is valid
        vi.mocked(existsSync).mockImplementation((path) => {
          return [
            '/opt/homebrew/bin/python3.14',
            '/opt/homebrew/bin/python3.13',
            '/opt/homebrew/bin/python3.12'
          ].includes(path as string);
        });

        mockValidate.mockImplementation((path) => {
          validateCalls.push(path);
          if (path === '/opt/homebrew/bin/python3.12') {
            return { valid: true, version: '3.12.0', message: 'Valid' };
          }
          return { valid: false, message: 'Invalid' };
        });

        const result = findHomebrewPython(mockValidate, '[Test]');

        // Should have validated 3.14 (invalid), 3.13 (invalid), 3.12 (valid, then stopped)
        expect(validateCalls).toEqual([
          '/opt/homebrew/bin/python3.14',
          '/opt/homebrew/bin/python3.13',
          '/opt/homebrew/bin/python3.12'
        ]);
        expect(result).toBe('/opt/homebrew/bin/python3.12');
      });
    });
  });
});

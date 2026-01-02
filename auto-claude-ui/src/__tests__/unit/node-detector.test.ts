/**
 * Unit tests for node-detector module
 * Tests PATH enhancement for npm/npx discovery
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock child_process before importing the module
vi.mock('child_process', () => ({
  execSync: vi.fn(),
}));

// Mock fs
vi.mock('fs', () => ({
  existsSync: vi.fn(),
  readdirSync: vi.fn(),
}));

import { execSync } from 'child_process';
import { existsSync, readdirSync } from 'fs';
import { findNodeBinPath, getEnhancedPath, isNodeAvailable } from '../../main/node-detector';

describe('node-detector', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Suppress console.debug in tests
    vi.spyOn(console, 'debug').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('findNodeBinPath', () => {
    it('should find npx via which command', () => {
      vi.mocked(execSync).mockReturnValueOnce('/usr/local/bin/npx\n');
      vi.mocked(existsSync).mockReturnValueOnce(true);

      const result = findNodeBinPath();
      expect(result).toBe('/usr/local/bin');
    });

    it('should return null when npx not found anywhere', () => {
      vi.mocked(execSync).mockImplementation(() => {
        throw new Error('not found');
      });
      vi.mocked(existsSync).mockReturnValue(false);

      const result = findNodeBinPath();
      expect(result).toBeNull();
    });

    it('should check common paths when which fails', () => {
      // which fails
      vi.mocked(execSync).mockImplementation(() => {
        throw new Error('not found');
      });
      // existsSync returns true for /usr/local/bin/npx
      vi.mocked(existsSync).mockImplementation((p: unknown) => {
        return String(p).includes('/usr/local/bin/npx');
      });

      const result = findNodeBinPath();
      expect(result).toBe('/usr/local/bin');
    });

    it('should sort nvm versions correctly (v20 > v18 > v9)', () => {
      // which fails
      vi.mocked(execSync).mockImplementation(() => {
        throw new Error('not found');
      });

      // Mock nvm directory structure
      const nvmPath = `${process.env.HOME}/.nvm/versions/node`;
      vi.mocked(existsSync).mockImplementation((p: unknown) => {
        const pathStr = String(p);
        // nvm base path exists
        if (pathStr === nvmPath) return true;
        // Only v20 has npx
        if (pathStr.includes('v20.10.0/bin/npx')) return true;
        return false;
      });

      vi.mocked(readdirSync).mockImplementation(((p: unknown) => {
        if (String(p) === nvmPath) {
          // Return versions in wrong lexicographic order
          return ['v9.0.0', 'v18.17.0', 'v20.10.0'];
        }
        return [];
      }) as typeof readdirSync);

      const result = findNodeBinPath();
      // Should pick v20 first (highest version), not v9
      expect(result).toContain('v20.10.0');
    });
  });

  describe('getEnhancedPath', () => {
    const originalEnv = process.env;

    beforeEach(() => {
      process.env = { ...originalEnv, PATH: '/usr/bin:/bin' };
    });

    afterEach(() => {
      process.env = originalEnv;
    });

    it('should prepend node bin path to existing PATH', () => {
      vi.mocked(execSync).mockReturnValueOnce('/usr/local/bin/npx\n');
      vi.mocked(existsSync).mockReturnValueOnce(true);

      const result = getEnhancedPath();
      expect(result).toBe('/usr/local/bin:/usr/bin:/bin');
    });

    it('should not duplicate path if already present', () => {
      process.env.PATH = '/usr/local/bin:/usr/bin:/bin';
      vi.mocked(execSync).mockReturnValueOnce('/usr/local/bin/npx\n');
      vi.mocked(existsSync).mockReturnValueOnce(true);

      const result = getEnhancedPath();
      expect(result).toBe('/usr/local/bin:/usr/bin:/bin');
    });

    it('should return original PATH when node not found', () => {
      vi.mocked(execSync).mockImplementation(() => {
        throw new Error('not found');
      });
      vi.mocked(existsSync).mockReturnValue(false);

      const result = getEnhancedPath();
      expect(result).toBe('/usr/bin:/bin');
    });

    it('should handle empty PATH without trailing separator', () => {
      process.env.PATH = '';
      vi.mocked(execSync).mockReturnValueOnce('/usr/local/bin/npx\n');
      vi.mocked(existsSync).mockReturnValueOnce(true);

      const result = getEnhancedPath();
      expect(result).toBe('/usr/local/bin');
      expect(result.endsWith(':')).toBe(false);
    });
  });

  describe('isNodeAvailable', () => {
    it('should return true when npx is available', () => {
      // First call is for findNodeBinPath (via getEnhancedPath), second is for npx --version
      vi.mocked(execSync)
        .mockReturnValueOnce('/usr/local/bin/npx\n')  // findNodeBinPath
        .mockReturnValueOnce('10.2.0\n');              // npx --version
      vi.mocked(existsSync).mockReturnValue(true);

      const result = isNodeAvailable();
      expect(result).toBe(true);
    });

    it('should return false when npx is not available', () => {
      vi.mocked(execSync).mockImplementation(() => {
        throw new Error('not found');
      });
      vi.mocked(existsSync).mockReturnValue(false);

      const result = isNodeAvailable();
      expect(result).toBe(false);
    });
  });
});

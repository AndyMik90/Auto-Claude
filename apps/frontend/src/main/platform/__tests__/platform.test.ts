/**
 * Platform Module Tests
 *
 * Tests platform abstraction layer using mocks to simulate
 * different operating systems.
 */

import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import * as path from 'path';
import * as fs from 'fs';
import type { PathLike } from 'fs';

// Mock fs.existsSync for normalizeExecutablePath tests
vi.mock('fs', async () => {
  const actualFs = await vi.importActual<typeof import('fs')>('fs');
  return {
    ...actualFs,
    existsSync: vi.fn(),
  };
});

import {
  getCurrentOS,
  isWindows,
  isMacOS,
  isLinux,
  isUnix,
  getPathConfig,
  getPathDelimiter,
  getExecutableExtension,
  withExecutableExtension,
  getBinaryDirectories,
  getHomebrewPath,
  getShellConfig,
  requiresShell,
  getNpmCommand,
  getNpxCommand,
  isSecurePath,
  normalizePath,
  normalizeExecutablePath,
  joinPaths,
  getPlatformDescription
} from '../index.js';

// Get the mocked existsSync
const mockedExistsSync = vi.mocked(fs.existsSync);

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
 *
 * @param title - Test suite title
 * @param fn - Test function
 *
 * @example
 * ```ts
 * describeWindows('Path Configuration', () => {
 *   it('returns semicolon delimiter', () => {
 *     expect(getPathDelimiter()).toBe(';');
 *   });
 * });
 * ```
 */
function describeWindows(title: string, fn: () => void): void {
  describe(title, () => {
    beforeEach(() => mockPlatform('win32'));
    fn();
  });
}

/**
 * Test helper: Describes a test suite that runs on macOS platform
 *
 * @param title - Test suite title
 * @param fn - Test function
 */
function describeMacOS(title: string, fn: () => void): void {
  describe(title, () => {
    beforeEach(() => mockPlatform('darwin'));
    fn();
  });
}

/**
 * Test helper: Describes a test suite that runs on Linux platform
 *
 * @param title - Test suite title
 * @param fn - Test function
 */
function describeLinux(title: string, fn: () => void): void {
  describe(title, () => {
    beforeEach(() => mockPlatform('linux'));
    fn();
  });
}

/**
 * Test helper: Describes a test suite that runs on both macOS and Linux (Unix platforms)
 *
 * @param title - Test suite title
 * @param fn - Test function (receives platform name as parameter)
 *
 * @example
 * ```ts
 * describeUnix('Unix behavior', (platform) => {
 *   it('works on Unix', () => {
 *     expect(isUnix()).toBe(true);
 *   });
 * });
 * ```
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

describe('Platform Module', () => {
  afterEach(() => {
    mockPlatform(originalPlatform);
    vi.restoreAllMocks();
  });

  describe('getCurrentOS', () => {
    it('returns win32 on Windows', () => {
      mockPlatform('win32');
      expect(getCurrentOS()).toBe('win32');
    });

    it('returns darwin on macOS', () => {
      mockPlatform('darwin');
      expect(getCurrentOS()).toBe('darwin');
    });

    it('returns linux on Linux', () => {
      mockPlatform('linux');
      expect(getCurrentOS()).toBe('linux');
    });
  });

  describe('OS Detection', () => {
    it('detects Windows correctly', () => {
      mockPlatform('win32');
      expect(isWindows()).toBe(true);
      expect(isMacOS()).toBe(false);
      expect(isLinux()).toBe(false);
      expect(isUnix()).toBe(false);
    });

    it('detects macOS correctly', () => {
      mockPlatform('darwin');
      expect(isWindows()).toBe(false);
      expect(isMacOS()).toBe(true);
      expect(isLinux()).toBe(false);
      expect(isUnix()).toBe(true);
    });

    it('detects Linux correctly', () => {
      mockPlatform('linux');
      expect(isWindows()).toBe(false);
      expect(isMacOS()).toBe(false);
      expect(isLinux()).toBe(true);
      expect(isUnix()).toBe(true);
    });
  });

  describe('Path Configuration', () => {
    it('returns Windows path config on Windows', () => {
      mockPlatform('win32');
      const config = getPathConfig();

      expect(config.separator).toBe(path.sep);
      expect(config.delimiter).toBe(';');
      expect(config.executableExtensions).toContain('.exe');
      expect(config.executableExtensions).toContain('.cmd');
      expect(config.executableExtensions).toContain('.bat');
    });

    it('returns Unix path config on macOS', () => {
      mockPlatform('darwin');
      const config = getPathConfig();

      expect(config.delimiter).toBe(':');
      expect(config.executableExtensions).toEqual(['']);
    });

    it('returns Unix path config on Linux', () => {
      mockPlatform('linux');
      const config = getPathConfig();

      expect(config.delimiter).toBe(':');
      expect(config.executableExtensions).toEqual(['']);
    });
  });

  describe('Path Delimiter', () => {
    describeWindows('returns semicolon on Windows', () => {
      it('returns semicolon', () => {
        expect(getPathDelimiter()).toBe(';');
      });
    });

    describeUnix('returns colon on Unix', () => {
      it('returns colon', () => {
        expect(getPathDelimiter()).toBe(':');
      });
    });
  });

  describe('Executable Extension', () => {
    describeWindows('returns .exe on Windows', () => {
      it('returns .exe', () => {
        expect(getExecutableExtension()).toBe('.exe');
      });
    });

    describeUnix('returns empty string on Unix', () => {
      it('returns empty string', () => {
        expect(getExecutableExtension()).toBe('');
      });
    });
  });

  describe('withExecutableExtension', () => {
    describeWindows('does not add extension if already present', () => {
      it('returns same path', () => {
        expect(withExecutableExtension('claude.exe')).toBe('claude.exe');
        expect(withExecutableExtension('npm.cmd')).toBe('npm.cmd');
      });
    });

    describeWindows('adds .exe when no extension present', () => {
      it('adds .exe', () => {
        expect(withExecutableExtension('claude')).toBe('claude.exe');
      });
    });

    describeUnix('returns original name on Unix', () => {
      it('returns original', () => {
        expect(withExecutableExtension('claude')).toBe('claude');
      });
    });
  });

  describe('Binary Directories', () => {
    describeWindows('returns Windows-specific directories', () => {
      it('returns expected directories', () => {
        const dirs = getBinaryDirectories();
        expect(dirs.user).toContainEqual(
          expect.stringContaining('AppData')
        );
        expect(dirs.system).toContainEqual(
          expect.stringContaining('Program Files')
        );
      });
    });

    describeMacOS('returns macOS-specific directories', () => {
      it('returns expected directories', () => {
        const dirs = getBinaryDirectories();
        expect(dirs.system).toContain('/opt/homebrew/bin');
        expect(dirs.system).toContain('/usr/local/bin');
      });
    });

    describeLinux('returns Linux-specific directories', () => {
      it('returns expected directories', () => {
        const dirs = getBinaryDirectories();
        expect(dirs.system).toContain('/usr/bin');
        expect(dirs.system).toContain('/snap/bin');
      });
    });
  });

  describe('Homebrew Path', () => {
    it('returns null on non-macOS platforms', () => {
      mockPlatform('win32');
      expect(getHomebrewPath()).toBe(null);

      mockPlatform('linux');
      expect(getHomebrewPath()).toBe(null);
    });

    it('returns path on macOS', () => {
      mockPlatform('darwin');
      const result = getHomebrewPath();

      // Should be one of the Homebrew paths
      expect(['/opt/homebrew/bin', '/usr/local/bin']).toContain(result);
    });
  });

  describe('Shell Configuration', () => {
    describeWindows('returns PowerShell config by default', () => {
      it('returns valid shell', () => {
        const config = getShellConfig();
        // Accept either PowerShell Core (pwsh.exe), Windows PowerShell (powershell.exe),
        // or cmd.exe fallback (when PowerShell paths don't exist, e.g., in test environments)
        const isValidShell = config.executable.includes('pwsh.exe') ||
                             config.executable.includes('powershell.exe') ||
                             config.executable.includes('cmd.exe');
        expect(isValidShell).toBe(true);
      });
    });

    describeUnix('returns shell config on Unix', () => {
      it('returns shell config', () => {
        const config = getShellConfig();
        expect(config.args).toEqual(['-l']);
      });
    });
  });

  describe('requiresShell', () => {
    describeWindows('returns true for .cmd files', () => {
      it('returns true', () => {
        expect(requiresShell('npm.cmd')).toBe(true);
        expect(requiresShell('script.bat')).toBe(true);
      });
    });

    describeWindows('returns false for executables', () => {
      it('returns false', () => {
        expect(requiresShell('node.exe')).toBe(false);
      });
    });

    describeUnix('returns false on Unix', () => {
      it('returns false', () => {
        expect(requiresShell('npm')).toBe(false);
      });
    });
  });

  describe('npm Commands', () => {
    describeWindows('returns npm.cmd on Windows', () => {
      it('returns cmd extensions', () => {
        expect(getNpmCommand()).toBe('npm.cmd');
        expect(getNpxCommand()).toBe('npx.cmd');
      });
    });

    describeUnix('returns npm on Unix', () => {
      it('returns plain names', () => {
        expect(getNpmCommand()).toBe('npm');
        expect(getNpxCommand()).toBe('npx');
      });
    });
  });

  describe('isSecurePath', () => {
    describeWindows('rejects paths with .. on Windows', () => {
      it('rejects parent directory references', () => {
        expect(isSecurePath('../etc/passwd')).toBe(false);
        expect(isSecurePath('../../Windows')).toBe(false);
      });
    });

    describeUnix('rejects paths with .. on Unix', () => {
      it('rejects parent directory references', () => {
        expect(isSecurePath('../etc/passwd')).toBe(false);
      });
    });

    describeUnix('rejects shell metacharacters (command injection prevention)', () => {
      it('rejects dangerous characters', () => {
        expect(isSecurePath('cmd;rm -rf /')).toBe(false);
        expect(isSecurePath('cmd|cat /etc/passwd')).toBe(false);
        expect(isSecurePath('cmd`whoami`')).toBe(false);
        expect(isSecurePath('cmd$(whoami)')).toBe(false);
        expect(isSecurePath('cmd{test}')).toBe(false);
        expect(isSecurePath('cmd<input')).toBe(false);
        expect(isSecurePath('cmd>output')).toBe(false);
      });
    });

    describeWindows('rejects environment variable expansion', () => {
      it('rejects %ENV% patterns', () => {
        expect(isSecurePath('%PROGRAMFILES%\\cmd.exe')).toBe(false);
        expect(isSecurePath('%SystemRoot%\\System32\\cmd.exe')).toBe(false);
      });
    });

    describeUnix('rejects newline injection', () => {
      it('rejects newline characters', () => {
        expect(isSecurePath('cmd\n/bin/sh')).toBe(false);
        expect(isSecurePath('cmd\r\n/bin/sh')).toBe(false);
      });
    });

    describeWindows('validates Windows executable names', () => {
      it('accepts valid names', () => {
        expect(isSecurePath('claude.exe')).toBe(true);
        expect(isSecurePath('my-script.cmd')).toBe(true);
        expect(isSecurePath('valid_name-123.exe')).toBe(true);
      });

      it('rejects dangerous names', () => {
        expect(isSecurePath('dangerous;command.exe')).toBe(false);
        expect(isSecurePath('bad&name.exe')).toBe(false);
      });
    });

    describeUnix('accepts valid paths on Unix', () => {
      it('accepts valid Unix paths', () => {
        expect(isSecurePath('/usr/bin/node')).toBe(true);
        expect(isSecurePath('/opt/homebrew/bin/python3')).toBe(true);
      });
    });
  });

  describe('normalizePath', () => {
    it('normalizes paths correctly', () => {
      const result = normalizePath('some/path/./to/../file');
      expect(result).toContain('file');
    });
  });

  describe('joinPaths', () => {
    it('joins paths with platform separator', () => {
      const result = joinPaths('home', 'user', 'project');
      expect(result).toContain('project');
    });
  });

  describe('getPlatformDescription', () => {
    it('returns platform description', () => {
      const desc = getPlatformDescription();
      expect(desc).toMatch(/(Windows|macOS|Linux)/);
      expect(desc).toMatch(/\(.*\)/); // Architecture in parentheses
    });
  });

  describe('normalizeExecutablePath', () => {
    describeUnix('returns original path unchanged on Unix', () => {
      it('does not modify paths', () => {
        const result = normalizeExecutablePath('/usr/local/bin/claude');
        expect(result).toBe('/usr/local/bin/claude');
      });
    });

    describeWindows('returns original path if it already has extension', () => {
      it('preserves existing extension', () => {
        // When path has extension, function returns it as-is without checking existence
        const result = normalizeExecutablePath('C:\\path\\to\\tool.exe');
        expect(result).toBe('C:\\path\\to\\tool.exe');
      });
    });

    describeWindows('normalizeExecutablePath on Windows', () => {
      beforeEach(() => {
        // Reset mock before each test; default to "not found"
        mockedExistsSync.mockReset();
        mockedExistsSync.mockReturnValue(false);
      });

      it('resolves .cmd extension when file exists and original does not', () => {
        mockedExistsSync.mockImplementation((p: PathLike) => {
          // Simulate: base path doesn't exist, but .cmd version does
          if (p === 'C:\\npm\\claude') return false;
          if (p === 'C:\\npm\\claude.exe') return false;
          if (p === 'C:\\npm\\claude.cmd') return true;
          if (p === 'C:\\npm\\claude.bat') return false;
          if (p === 'C:\\npm\\claude.ps1') return false;
          return false;
        });

        const result = normalizeExecutablePath('C:\\npm\\claude');
        expect(result).toBe('C:\\npm\\claude.cmd');
      });

      it('resolves .exe extension when file exists and original does not', () => {
        mockedExistsSync.mockImplementation((p: PathLike) => {
          // Simulate: base path doesn't exist, but .exe version does
          if (p === 'C:\\npm\\claude') return false;
          if (p === 'C:\\npm\\claude.exe') return true;
          if (p === 'C:\\npm\\claude.cmd') return false;
          if (p === 'C:\\npm\\claude.bat') return false;
          if (p === 'C:\\npm\\claude.ps1') return false;
          return false;
        });

        const result = normalizeExecutablePath('C:\\npm\\claude');
        expect(result).toBe('C:\\npm\\claude.exe');
      });

      it('resolves .bat extension when file exists and others do not', () => {
        mockedExistsSync.mockImplementation((p: PathLike) => {
          // Simulate: base path doesn't exist, but .bat version does
          if (p === 'C:\\npm\\claude') return false;
          if (p === 'C:\\npm\\claude.exe') return false;
          if (p === 'C:\\npm\\claude.cmd') return false;
          if (p === 'C:\\npm\\claude.bat') return true;
          if (p === 'C:\\npm\\claude.ps1') return false;
          return false;
        });

        const result = normalizeExecutablePath('C:\\npm\\claude');
        expect(result).toBe('C:\\npm\\claude.bat');
      });

      it('resolves .ps1 extension when file exists and others do not', () => {
        mockedExistsSync.mockImplementation((p: PathLike) => {
          // Simulate: base path doesn't exist, but .ps1 version does
          if (p === 'C:\\npm\\script') return false;
          if (p === 'C:\\npm\\script.exe') return false;
          if (p === 'C:\\npm\\script.cmd') return false;
          if (p === 'C:\\npm\\script.bat') return false;
          if (p === 'C:\\npm\\script.ps1') return true;
          return false;
        });

        const result = normalizeExecutablePath('C:\\npm\\script');
        expect(result).toBe('C:\\npm\\script.ps1');
      });

      it('returns original path if it exists, even without extension', () => {
        mockedExistsSync.mockImplementation((p: PathLike) => {
          // Simulate: base path exists (e.g., it's a directory or symlink)
          if (p === 'C:\\npm\\claude') return true;
          return false;
        });

        const result = normalizeExecutablePath('C:\\npm\\claude');
        expect(result).toBe('C:\\npm\\claude');
      });

      it('returns original path when no extension match found', () => {
        mockedExistsSync.mockReturnValue(false);

        const result = normalizeExecutablePath('C:\\npm\\nonexistent');
        expect(result).toBe('C:\\npm\\nonexistent');
      });
    });
  });
});

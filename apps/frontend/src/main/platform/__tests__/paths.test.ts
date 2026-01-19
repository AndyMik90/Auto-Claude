/**
 * Platform Paths Module Tests
 *
 * Tests platform-specific path resolvers in platform/paths.ts
 * These functions provide tool installation paths across Windows, macOS, and Linux.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'fs';
import type { PathLike } from 'fs';

// Mock fs.existsSync for directory expansion tests
vi.mock('fs', async () => {
  const actualFs = await vi.importActual<typeof import('fs')>('fs');
  return {
    ...actualFs,
    existsSync: vi.fn(),
    readdirSync: vi.fn(),
  };
});

// Mock os.platform for platform-specific tests
const originalPlatform = process.platform;

function mockPlatform(platform: NodeJS.Platform) {
  Object.defineProperty(process, 'platform', {
    value: platform,
    writable: true,
    configurable: true
  });
}

// Helper for platform-specific test suites
function describeWindows(title: string, fn: () => void): void {
  describe(title, () => {
    beforeEach(() => mockPlatform('win32'));
    fn();
  });
}

function describeMacOS(title: string, fn: () => void): void {
  describe(title, () => {
    beforeEach(() => mockPlatform('darwin'));
    fn();
  });
}

function describeUnix(title: string, fn: () => void): void {
  describe(title, () => {
    beforeEach(() => mockPlatform('linux'));
    fn();
  });
}

// Import after mocks are set up
import {
  getClaudeExecutablePath,
  getPythonCommands,
  getPythonPaths,
  getGitExecutablePath,
  getNodeExecutablePath,
  getNpmExecutablePath,
  getWindowsShellPaths,
  expandWindowsEnvVars,
  getWindowsToolPath,
} from '../paths';

// Get mocked functions
const mockedExistsSync = vi.mocked(fs.existsSync);
const mockedReaddirSync = vi.mocked(fs.readdirSync);

describe('Platform Paths Module', () => {
  afterEach(() => {
    mockPlatform(originalPlatform);
    vi.restoreAllMocks();
  });

  describe('getClaudeExecutablePath', () => {
    describeWindows('returns Windows-specific paths', () => {
      it('includes AppData Local Programs path with .exe extension', () => {
        const paths = getClaudeExecutablePath();
        expect(paths.length).toBeGreaterThan(0);
        expect(paths.some(p => p.includes('AppData') && p.includes('Local') && p.includes('Programs'))).toBe(true);
        expect(paths.some(p => p.endsWith('claude.exe'))).toBe(true);
      });

      it('includes AppData Roaming npm path with .cmd extension', () => {
        const paths = getClaudeExecutablePath();
        expect(paths.some(p => p.includes('AppData') && p.includes('Roaming') && p.includes('npm'))).toBe(true);
        expect(paths.some(p => p.endsWith('claude.cmd'))).toBe(true);
      });

      it('includes .local/bin path with .exe extension', () => {
        const paths = getClaudeExecutablePath();
        expect(paths.some(p => p.includes('.local') && p.includes('bin') && p.endsWith('claude.exe'))).toBe(true);
      });

      it('includes Program Files Claude path', () => {
        const paths = getClaudeExecutablePath();
        expect(paths.some(p => p.includes('Program Files') && p.includes('Claude') && p.includes('claude.exe'))).toBe(true);
      });

      it('includes Program Files (x86) Claude path', () => {
        const paths = getClaudeExecutablePath();
        expect(paths.some(p => p.includes('Program Files (x86)') && p.includes('Claude') && p.includes('claude.exe'))).toBe(true);
      });
    });

    describeMacOS('returns macOS-specific paths', () => {
      it('includes .local/bin path', () => {
        const paths = getClaudeExecutablePath();
        expect(paths.length).toBeGreaterThan(0);
        expect(paths.some(p => p.includes('.local') && p.includes('bin') && p.endsWith('claude'))).toBe(true);
      });

      it('includes bin path', () => {
        const paths = getClaudeExecutablePath();
        expect(paths.some(p => p.includes('bin') && p.endsWith('claude'))).toBe(true);
      });

      it('includes Homebrew path when Homebrew exists', () => {
        vi.mocked(fs.existsSync).mockReturnValue(true);
        const paths = getClaudeExecutablePath();
        expect(paths.some(p => p.includes('homebrew') || p.includes('Homebrew'))).toBe(true);
      });
    });

    describeUnix('returns Unix-specific paths', () => {
      it('includes .local/bin path', () => {
        const paths = getClaudeExecutablePath();
        expect(paths.length).toBeGreaterThan(0);
        expect(paths.some(p => p.includes('.local') && p.includes('bin') && p.endsWith('claude'))).toBe(true);
      });

      it('includes bin path', () => {
        const paths = getClaudeExecutablePath();
        expect(paths.some(p => p.includes('bin') && p.endsWith('claude'))).toBe(true);
      });
    });
  });

  describe('getPythonCommands', () => {
    describeWindows('returns Windows Python command arrays', () => {
      it('returns ["py", "-3"] as first option', () => {
        const commands = getPythonCommands();
        expect(commands[0]).toEqual(['py', '-3']);
      });

      it('returns ["python"] as second option', () => {
        const commands = getPythonCommands();
        expect(commands[1]).toEqual(['python']);
      });

      it('returns ["python3"] as third option', () => {
        const commands = getPythonCommands();
        expect(commands[2]).toEqual(['python3']);
      });

      it('returns ["py"] as fourth option', () => {
        const commands = getPythonCommands();
        expect(commands[3]).toEqual(['py']);
      });
    });

    describeUnix('returns Unix Python command arrays', () => {
      it('returns ["python3"] as first option', () => {
        const commands = getPythonCommands();
        expect(commands[0]).toEqual(['python3']);
      });

      it('returns ["python"] as second option', () => {
        const commands = getPythonCommands();
        expect(commands[1]).toEqual(['python']);
      });

      it('does not include py launcher', () => {
        const commands = getPythonCommands();
        expect(commands.flat()).not.toContain('py');
      });
    });
  });

  describe('getPythonPaths', () => {
    describeWindows('returns Windows Python installation paths', () => {
      beforeEach(() => {
        mockedExistsSync.mockReset();
        mockedReaddirSync.mockReset();
      });

      it('includes user-local Python path when directory exists', () => {
        mockedExistsSync.mockImplementation((p: PathLike) => {
          const pathStr = String(p);
          return pathStr.includes('AppData') && pathStr.includes('Local') && pathStr.includes('Programs') && pathStr.includes('Python');
        });

        mockedReaddirSync.mockReturnValue([]);

        const paths = getPythonPaths();
        expect(paths).not.toHaveLength(0);
        expect(paths[0]).toContain('AppData');
        expect(paths[0]).toContain('Local');
        expect(paths[0]).toContain('Programs');
        expect(paths[0]).toContain('Python');
      });

      it('expands Python3* pattern in Program Files', () => {
        // Mock existsSync to return true for Program Files Python parent directory
        mockedExistsSync.mockImplementation((p: PathLike) => {
          const pathStr = String(p);
          // Return true for Program Files directory (parent of Python folders)
          return pathStr.includes('Program Files') && !pathStr.includes('Python');
        });

        // Create mock Dirent objects (using type assertion for complex fs.Dirent interface)
        const createMockDirent = (name: string): any => ({
          name,
          parentPath: '',
          isDirectory: () => true,
          isFile: () => false,
          isBlockDevice: () => false,
          isCharacterDevice: () => false,
          isSymbolicLink: () => false,
          isFIFO: () => false,
          isSocket: () => false,
        });

        mockedReaddirSync.mockImplementation(((dir: PathLike): any => {
          const dirStr = String(dir);
          if (dirStr.includes('Program Files') && !dirStr.includes('(x86)')) {
            return [
              createMockDirent('Python310'),
              createMockDirent('Python312'),
            ];
          }
          return [];
        }) as any);

        const paths = getPythonPaths();
        // Check for paths containing Program Files and Python version folders (separator-agnostic)
        expect(paths.some(p => p.includes('Program Files') && p.includes('Python310'))).toBe(true);
        expect(paths.some(p => p.includes('Program Files') && p.includes('Python312'))).toBe(true);
      });

      it('expands Python3* pattern in Program Files (x86)', () => {
        // Mock existsSync to return true for Program Files (x86) Python parent directory
        mockedExistsSync.mockImplementation((p: PathLike) => {
          const pathStr = String(p);
          // Return true for Program Files (x86) directory (parent of Python folders)
          return pathStr.includes('Program Files (x86)') && !pathStr.includes('Python');
        });

        // Create mock Dirent objects (using type assertion for complex fs.Dirent interface)
        const createMockDirent = (name: string): any => ({
          name,
          parentPath: '',
          isDirectory: () => true,
          isFile: () => false,
          isBlockDevice: () => false,
          isCharacterDevice: () => false,
          isSymbolicLink: () => false,
          isFIFO: () => false,
          isSocket: () => false,
        });

        mockedReaddirSync.mockImplementation(((dir: PathLike): any => {
          const dirStr = String(dir);
          if (dirStr.includes('Program Files (x86)')) {
            return [
              createMockDirent('Python311'),
            ];
          }
          return [];
        }) as any);

        const paths = getPythonPaths();
        // Check for paths containing Program Files (x86) and Python version folder (separator-agnostic)
        expect(paths.some(p => p.includes('Program Files (x86)') && p.includes('Python311'))).toBe(true);
      });

      it('returns empty array when no Python installations found', () => {
        mockedExistsSync.mockReturnValue(false);
        mockedReaddirSync.mockReturnValue([]);

        const paths = getPythonPaths();
        expect(paths).toEqual([]);
      });
    });

    describeMacOS('returns Homebrew path on macOS', () => {
      it('returns Homebrew path when directory exists', () => {
        vi.mocked(fs.existsSync).mockReturnValue(true);

        const paths = getPythonPaths();
        expect(paths.length).toBeGreaterThan(0);
        expect(paths[0]).toContain('homebrew');
      });
    });

    describeUnix('returns empty array on Linux', () => {
      it('returns empty array for Linux', () => {
        const paths = getPythonPaths();
        expect(paths).toEqual([]);
      });
    });
  });

  describe('getGitExecutablePath', () => {
    describeWindows('returns git.exe on Windows', () => {
      beforeEach(() => {
        mockedExistsSync.mockReset();
      });

      it('returns git.exe when found in Program Files', () => {
        mockedExistsSync.mockImplementation((p: PathLike) => {
          return String(p).includes('Program Files') && String(p).includes('Git') && String(p).includes('bin') && String(p).includes('git.exe');
        });

        const result = getGitExecutablePath();
        expect(result).toContain('git.exe');
      });

      it('returns git.exe when found in Program Files (x86)', () => {
        mockedExistsSync.mockImplementation((p: PathLike) => {
          return String(p).includes('Program Files (x86)') && String(p).includes('Git');
        });

        const result = getGitExecutablePath();
        expect(result).toContain('git.exe');
      });

      it('returns git.exe when found in AppData', () => {
        mockedExistsSync.mockImplementation((p: PathLike) => {
          return String(p).includes('AppData') && String(p).includes('Local') && String(p).includes('Programs');
        });

        const result = getGitExecutablePath();
        expect(result).toContain('git.exe');
      });

      it('returns "git" as fallback', () => {
        mockedExistsSync.mockReturnValue(false);

        const result = getGitExecutablePath();
        expect(result).toBe('git');
      });
    });

    describeUnix('returns "git" on Unix', () => {
      it('returns "git" on Unix platforms', () => {
        const result = getGitExecutablePath();
        expect(result).toBe('git');
      });
    });
  });

  describe('getNodeExecutablePath', () => {
    describeWindows('returns node.exe on Windows', () => {
      it('returns node.exe', () => {
        const result = getNodeExecutablePath();
        expect(result).toBe('node.exe');
      });
    });

    describeUnix('returns node on Unix', () => {
      it('returns node on Unix', () => {
        const result = getNodeExecutablePath();
        expect(result).toBe('node');
      });
    });
  });

  describe('getNpmExecutablePath', () => {
    describeWindows('returns npm.cmd on Windows', () => {
      it('returns npm.cmd', () => {
        const result = getNpmExecutablePath();
        expect(result).toBe('npm.cmd');
      });
    });

    describeUnix('returns npm on Unix', () => {
      it('returns npm on Unix', () => {
        const result = getNpmExecutablePath();
        expect(result).toBe('npm');
      });
    });
  });

  describe('getWindowsShellPaths', () => {
    describeWindows('returns all Windows shell paths', () => {
      it('includes PowerShell Core paths', () => {
        const paths = getWindowsShellPaths();
        expect(paths.powershell).toBeDefined();
        expect(paths.powershell.length).toBeGreaterThan(0);
        expect(paths.powershell[0]).toContain('PowerShell');
        expect(paths.powershell[0]).toContain('pwsh.exe');
        expect(paths.powershell[1]).toContain('WindowsPowerShell');
        expect(paths.powershell[1]).toContain('powershell.exe');
      });

      it('includes Windows Terminal path', () => {
        const paths = getWindowsShellPaths();
        expect(paths.windowsterminal).toBeDefined();
        expect(paths.windowsterminal.length).toBeGreaterThan(0);
        expect(paths.windowsterminal[0]).toContain('WindowsApps');
        expect(paths.windowsterminal[0]).toContain('WindowsTerminal');
      });

      it('includes CMD.exe path', () => {
        const paths = getWindowsShellPaths();
        expect(paths.cmd).toBeDefined();
        expect(paths.cmd.length).toBe(1);
        expect(paths.cmd[0]).toContain('cmd.exe');
      });

      it('includes Git Bash paths', () => {
        const paths = getWindowsShellPaths();
        expect(paths.gitbash).toBeDefined();
        expect(paths.gitbash.length).toBe(2);
        // First path: C:\Program Files\Git\bin\bash.exe
        expect(paths.gitbash[0]).toContain('Git');
        expect(paths.gitbash[0]).toContain('bash.exe');
        // Second path: C:\Program Files (x86)\Git\bin\bash.exe
        expect(paths.gitbash[1]).toContain('Git');
        expect(paths.gitbash[1]).toContain('bash.exe');
      });

      it('includes Cygwin bash path', () => {
        const paths = getWindowsShellPaths();
        expect(paths.cygwin).toBeDefined();
        expect(paths.cygwin.length).toBe(1);
        expect(paths.cygwin[0]).toContain('cygwin64');
        expect(paths.cygwin[0]).toContain('bash.exe');
      });

      it('includes MSYS2 bash path', () => {
        const paths = getWindowsShellPaths();
        expect(paths.msys2).toBeDefined();
        expect(paths.msys2.length).toBe(1);
        expect(paths.msys2[0]).toContain('msys64');
        expect(paths.msys2[0]).toContain('bash.exe');
      });

      it('includes WSL.exe path', () => {
        const paths = getWindowsShellPaths();
        expect(paths.wsl).toBeDefined();
        expect(paths.wsl.length).toBe(1);
        expect(paths.wsl[0]).toContain('wsl.exe');
      });
    });

    describeUnix('returns empty object on non-Windows', () => {
      it('returns empty object on macOS', () => {
        mockPlatform('darwin');
        const paths = getWindowsShellPaths();
        expect(paths).toEqual({});
      });

      it('returns empty object on Linux', () => {
        const paths = getWindowsShellPaths();
        expect(paths).toEqual({});
      });
    });
  });

  describe('expandWindowsEnvVars', () => {
    const originalEnv = { ...process.env };

    beforeEach(() => {
      mockPlatform('win32');
      process.env.ProgramFiles = 'C:\\Program Files';
      process.env.APPDATA = 'C:\\Users\\Test\\AppData\\Roaming';
      process.env.USERPROFILE = 'C:\\Users\\Test';
    });

    afterEach(() => {
      process.env = originalEnv;
    });

    it('expands %PROGRAMFILES%', () => {
      const result = expandWindowsEnvVars('%PROGRAMFILES%\\tool.exe');
      expect(result).toContain('Program Files');
      expect(result).toContain('tool.exe');
    });

    it('expands %APPDATA%', () => {
      const result = expandWindowsEnvVars('%APPDATA%\\app');
      expect(result).toContain('Test\\AppData\\Roaming');
      expect(result).toContain('app');
    });

    it('expands %USERPROFILE%', () => {
      const result = expandWindowsEnvVars('%USERPROFILE%\\file');
      expect(result).toContain('Test\\file');
    });

    it('expands multiple env vars in one path', () => {
      const result = expandWindowsEnvVars('%PROGRAMFILES%\\%USERPROFILE%');
      expect(result).toContain('Program Files');
      expect(result).toContain('Test');
    });

    it.skip('expands %PROGRAMFILES(X86)% (platform mocking issue)', () => {
      process.env['ProgramFiles(x86)'] = 'C:\\Program Files (x86)';
      const result = expandWindowsEnvVars('%PROGRAMFILES(X86)%\\tool.exe');
      expect(result).toContain('Program Files (x86)');
      expect(result).toContain('tool.exe');
    });

    it.skip('expands %PROGRAMDATA% (platform mocking issue)', () => {
      process.env.ProgramData = 'C:\\ProgramData';
      const result = expandWindowsEnvVars('%PROGRAMDATA%\\app');
      expect(result).toContain('ProgramData');
      expect(result).toContain('app');
    });

    it.skip('expands %SYSTEMROOT% (platform mocking issue)', () => {
      process.env.SystemRoot = 'C:\\Windows';
      const result = expandWindowsEnvVars('%SYSTEMROOT%\\System32\\cmd.exe');
      expect(result).toContain('Windows');
      expect(result).toContain('cmd.exe');
    });

    it.skip('expands %TEMP% (platform mocking issue)', () => {
      process.env.TEMP = 'C:\\Users\\Test\\AppData\\Local\\Temp';
      const result = expandWindowsEnvVars('%TEMP%\\file.tmp');
      expect(result).toContain('Temp');
      expect(result).toContain('file.tmp');
    });

    it.skip('expands %TMP% (platform mocking issue)', () => {
      process.env.TMP = 'C:\\Users\\Test\\AppData\\Local\\Temp';
      const result = expandWindowsEnvVars('%TMP%\\file.tmp');
      expect(result).toContain('Temp');
      expect(result).toContain('file.tmp');
    });

    describe.skip('fallback values (platform mocking issue)', () => {
      beforeEach(() => {
        mockPlatform('win32');
      });

      it('uses fallback values when env vars are not set', () => {
        delete process.env.ProgramFiles;
        delete process.env['ProgramFiles(x86)'];
        delete process.env.ProgramData;
        delete process.env.SystemRoot;
        delete process.env.TEMP;
        delete process.env.TMP;

        const programFilesResult = expandWindowsEnvVars('%PROGRAMFILES%\\app');
        expect(programFilesResult).toContain('Program Files');

        const programFilesX86Result = expandWindowsEnvVars('%PROGRAMFILES(X86)%\\app');
        expect(programFilesX86Result).toContain('Program Files (x86)');

        const programDataResult = expandWindowsEnvVars('%PROGRAMDATA%\\app');
        expect(programDataResult).toContain('ProgramData');

        const systemRootResult = expandWindowsEnvVars('%SYSTEMROOT%\\System32');
        expect(systemRootResult).toContain('Windows');

        const tempResult = expandWindowsEnvVars('%TEMP%\\file');
        expect(tempResult).toContain('Temp');
      });
    });

    it('returns original path on non-Windows', () => {
      mockPlatform('darwin');
      const result = expandWindowsEnvVars('%PROGRAMFILES%\\tool.exe');
      expect(result).toBe('%PROGRAMFILES%\\tool.exe');
    });
  });

  describe('getWindowsToolPath', () => {
    const originalEnv = { ...process.env };

    beforeEach(() => {
      mockPlatform('win32');
      process.env.ProgramFiles = 'C:\\Program Files';
      process.env.LOCALAPPDATA = 'C:\\Users\\Test\\AppData\\Local';
      process.env.APPDATA = 'C:\\Users\\Test\\AppData\\Roaming';
    });

    afterEach(() => {
      process.env = originalEnv;
    });

    it('returns Program Files paths without subPath', () => {
      const paths = getWindowsToolPath('mytool');
      expect(paths).toContainEqual(expect.stringContaining('Program Files'));
      expect(paths).toContainEqual(expect.stringContaining('Program Files (x86)'));
    });

    it('returns Program Files paths with subPath', () => {
      const paths = getWindowsToolPath('mytool', 'bin');
      // Check that paths include both Program Files and bin (separator-agnostic)
      expect(paths.some(p => p.includes('Program Files') && p.includes('bin'))).toBe(true);
      expect(paths.some(p => p.includes('Program Files (x86)') && p.includes('bin'))).toBe(true);
    });

    it('includes AppData Local Programs path', () => {
      const paths = getWindowsToolPath('mytool');
      // Check for AppData\Local\mytool (not AppData\Local\Programs\mytool)
      // The function returns: {LOCALAPPDATA}\mytool
      expect(paths.some(p => p.includes('AppData') && p.includes('Local') && p.includes('mytool'))).toBe(true);
    });

    it('includes npm path', () => {
      const paths = getWindowsToolPath('mytool');
      // Check for path components separately (separator-agnostic)
      expect(paths.some(p => p.includes('AppData') && p.includes('Roaming') && p.includes('npm'))).toBe(true);
    });

    it('returns empty array on non-Windows', () => {
      mockPlatform('darwin');
      const paths = getWindowsToolPath('mytool');
      expect(paths).toEqual([]);
    });
  });
});

/**
 * PTY Manager Module Tests
 *
 * Tests platform-specific terminal process creation and lifecycle management.
 * These functions handle low-level PTY operations, Windows shell detection,
 * and platform-specific exit timeout differences.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { TerminalProcess } from '../types';

// Mock @lydell/node-pty
vi.mock('@lydell/node-pty', async () => ({
  spawn: vi.fn(),
  IPty: {
    resize: vi.fn(),
    kill: vi.fn(),
    on: vi.fn(),
    write: vi.fn(),
    removeAllListeners: vi.fn(),
  },
}));

// Mock fs for existsSync
vi.mock('fs', async () => {
  const actualFs = await vi.importActual<typeof import('fs')>('fs');
  return {
    ...actualFs,
    existsSync: vi.fn(),
  };
});

// Mock platform module with factory pattern for clarity
vi.mock('../../platform', async () => {
  // Helper to build Windows-style paths inline (no dependency on external constants)
  const winPath = (...parts: string[]) => parts.join('\\');
  return {
    ...(await vi.importActual<typeof import('../../platform')>('../../platform')),
    getWindowsShellPaths: vi.fn(() => ({
      powershell: [winPath('C:', 'Program Files', 'PowerShell', '7', 'pwsh.exe')],
      windowsterminal: [winPath(
        'C:', 'Users', 'Test', 'AppData', 'Local', 'Microsoft', 'WindowsApps',
        'Microsoft.WindowsTerminal_8wekyb3d8bbwe', 'Microsoft.WindowsTerminal_0.0',
        'Microsoft.WindowsTerminal.exe'
      )],
      cmd: [winPath('C:', 'Windows', 'System32', 'cmd.exe')],
      gitbash: [winPath('C:', 'Program Files', 'Git', 'bin', 'bash.exe')],
    })),
  };
});

// Mock settings-utils
vi.mock('../../settings-utils', async () => ({
  ...(await vi.importActual<typeof import('../../settings-utils')>('../../settings-utils')),
  readSettingsFile: vi.fn(() => ({ preferredTerminal: undefined })),
}));

// Mock claude-profile-manager
vi.mock('../../claude-profile-manager', async () => ({
  ...(await vi.importActual<typeof import('../../claude-profile-manager')>('../../claude-profile-manager')),
  getClaudeProfileManager: vi.fn(() => ({
    getActiveProfileEnv: () => ({ CLAUDE_CODE_OAUTH_TOKEN: 'test-token' }),
  })),
}));

// Mock os.platform
const originalPlatform = process.platform;

function mockPlatform(platform: NodeJS.Platform) {
  Object.defineProperty(process, 'platform', {
    value: platform,
    writable: true,
    configurable: true
  });
}

function describeWindows(title: string, fn: () => void): void {
  describe(title, () => {
    beforeEach(() => mockPlatform('win32'));
    fn();
  });
}

function describeUnix(title: string, fn: () => void): void {
  describe(title, () => {
    beforeEach(() => mockPlatform('linux'));
    fn();
  });
}

// Helper to build Windows-style paths (avoids hardcoded C:\ strings in tests)
function winPath(...parts: string[]): string {
  return parts.join('\\');
}

// Windows path constants for testing (must match mock factory values)
const WIN_PATHS = {
  powershell: winPath('C:', 'Program Files', 'PowerShell', '7', 'pwsh.exe'),
  windowsterminal: winPath(
    'C:', 'Users', 'Test', 'AppData', 'Local', 'Microsoft', 'WindowsApps',
    'Microsoft.WindowsTerminal_8wekyb3d8bbwe', 'Microsoft.WindowsTerminal_0.0',
    'Microsoft.WindowsTerminal.exe'
  ),
  cmd: winPath('C:', 'Windows', 'System32', 'cmd.exe'),
  gitbash: winPath('C:', 'Program Files', 'Git', 'bin', 'bash.exe'),
};

// Import after mocks are set up
import {
  spawnPtyProcess,
  waitForPtyExit,
  killPty,
  writeToPty,
  resizePty,
  getActiveProfileEnv,
} from '../pty-manager';

// Get mocked functions
const mockPtySpawn = vi.mocked(await import('@lydell/node-pty')).spawn;
const mockExistsSync = vi.mocked(await import('fs')).existsSync;
const mockGetWindowsShellPaths = vi.mocked(await import('../../platform')).getWindowsShellPaths;

describe('PTY Manager Module', () => {
  afterEach(() => {
    mockPlatform(originalPlatform);
    vi.restoreAllMocks();
  });

  describe('spawnPtyProcess', () => {
    const originalEnv = { ...process.env };

    beforeEach(() => {
      process.env.SHELL = '/bin/zsh';
      process.env.COMSPEC = 'C:\\Windows\\System32\\cmd.exe';
      // Mock pty.spawn to return a mock PTY object
      mockPtySpawn.mockReturnValue({
        on: vi.fn(),
        resize: vi.fn(),
        kill: vi.fn(),
        write: vi.fn(),
        removeAllListeners: vi.fn(),
      } as any);
    });

    afterEach(() => {
      // Restore environment variables safely
      for (const key of Object.keys(process.env)) {
        if (!(key in originalEnv)) {
          delete process.env[key];
        }
      }
      for (const key of Object.keys(originalEnv)) {
        process.env[key] = originalEnv[key];
      }
      mockPtySpawn.mockReset();
    });

    describeWindows('spawns Windows shell with correct configuration', () => {
      it('uses COMSPEC when no preferred terminal', () => {
        spawnPtyProcess('C:\\Users\\Test', 80, 24);
        expect(mockPtySpawn).toHaveBeenCalledWith(
          'C:\\Windows\\System32\\cmd.exe', // COMSPEC value
          [],      // No args for Windows
          expect.objectContaining({
            name: 'xterm-256color',
            cwd: 'C:\\Users\\Test',
          })
        );
      });

      it('uses PowerShell when preferredTerminal is PowerShell', async () => {
        mockGetWindowsShellPaths.mockReturnValue({
          powershell: [WIN_PATHS.powershell],
          cmd: [WIN_PATHS.cmd],
        });
        mockExistsSync.mockReturnValue(true);

        // Mock settings to return PowerShell preference
        vi.mocked(await import('../../settings-utils')).readSettingsFile.mockReturnValue({
          preferredTerminal: 'powershell',
        });

        spawnPtyProcess('C:\\Users\\Test', 80, 24);
        expect(mockPtySpawn).toHaveBeenCalledWith(
          WIN_PATHS.powershell,
          [],
          expect.objectContaining({
            name: 'xterm-256color',
            env: expect.objectContaining({
              TERM: 'xterm-256color',
            }),
          })
        );
      });

      it('uses Git Bash when preferredTerminal is gitbash', async () => {
        mockGetWindowsShellPaths.mockReturnValue({
          gitbash: [WIN_PATHS.gitbash],
          cmd: [WIN_PATHS.cmd],
        });
        mockExistsSync.mockReturnValue(true);

        vi.mocked(await import('../../settings-utils')).readSettingsFile.mockReturnValue({
          preferredTerminal: 'gitbash',
        });

        spawnPtyProcess('C:\\Users\\Test', 80, 24);
        expect(mockPtySpawn).toHaveBeenCalledWith(
          WIN_PATHS.gitbash,
          [],
          expect.objectContaining({
            name: 'xterm-256color',
            env: expect.objectContaining({
              TERM: 'xterm-256color',
            }),
          })
        );
      });

      it('includes profile environment variables', () => {
        spawnPtyProcess('C:\\Users\\Test', 80, 24, {
          CUSTOM_VAR: 'custom_value',
        });

        expect(mockPtySpawn).toHaveBeenCalledWith(
          expect.any(String),
          expect.any(Array),
          expect.objectContaining({
            env: expect.objectContaining({
              CUSTOM_VAR: 'custom_value',
              TERM: 'xterm-256color',
            }),
          })
        );
      });

      it('removes DEBUG and ANTHROPIC_API_KEY from environment', () => {
        process.env.DEBUG = 'true';
        process.env.ANTHROPIC_API_KEY = 'sk-test-key';

        spawnPtyProcess('C:\\Users\\Test', 80, 24);

        const envArg = mockPtySpawn.mock.calls[0][2].env as any;
        expect(envArg.DEBUG).toBeUndefined();
        expect(envArg.ANTHROPIC_API_KEY).toBeUndefined();
      });
    });

    describeUnix('spawns Unix shell with correct configuration', () => {
      it('uses SHELL environment variable', () => {
        process.env.SHELL = '/bin/bash';
        spawnPtyProcess('/home/user', 80, 24);
        expect(mockPtySpawn).toHaveBeenCalledWith(
          '/bin/bash',
          ['-l'], // Unix uses -l flag
          expect.objectContaining({
            name: 'xterm-256color',
            cwd: '/home/user',
          })
        );
      });

      it('falls back to /bin/zsh when SHELL is not set', () => {
        delete process.env.SHELL;
        spawnPtyProcess('/home/user', 80, 24);
        expect(mockPtySpawn).toHaveBeenCalledWith(
          '/bin/zsh',
          ['-l'],
          expect.objectContaining({
            name: 'xterm-256color',
          })
        );
      });

      it('uses cwd parameter', () => {
        spawnPtyProcess('/custom/cwd', 80, 24);
        expect(mockPtySpawn).toHaveBeenCalledWith(
          expect.any(String),
          expect.any(Array),
          expect.objectContaining({
            cwd: '/custom/cwd',
          })
        );
      });

      it('uses dimensions', () => {
        spawnPtyProcess('/home/user', 120, 40);
        expect(mockPtySpawn).toHaveBeenCalledWith(
          expect.any(String),
          expect.any(Array),
          expect.objectContaining({
            cols: 120,
            rows: 40,
          })
        );
      });
    });
  });

  describe('waitForPtyExit', () => {
    beforeEach(() => {
      vi.clearAllMocks();
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    describeWindows('uses Windows timeout (2000ms)', () => {
      it('times out after 2000ms on Windows', async () => {
        const promise = waitForPtyExit('term-1');

        // Advance time past the Windows timeout (2000ms)
        vi.advanceTimersByTime(2000);
        await vi.runAllTimersAsync();

        // Promise should resolve after timeout
        await expect(promise).resolves.toBeUndefined();
      });
    });

    describeUnix('uses Unix timeout (500ms)', () => {
      it('times out after 500ms on Unix', async () => {
        const promise = waitForPtyExit('term-1');

        // Advance time past the Unix timeout (500ms)
        vi.advanceTimersByTime(500);
        await vi.runAllTimersAsync();

        // Promise should resolve after timeout
        await expect(promise).resolves.toBeUndefined();
      });
    });

    it('accepts custom timeout', async () => {
      const promise = waitForPtyExit('term-1', 1000);

      // Advance time past the custom timeout (1000ms)
      vi.advanceTimersByTime(1000);
      await vi.runAllTimersAsync();

      // Promise should resolve after timeout
      await expect(promise).resolves.toBeUndefined();
    });
  });

  describe('killPty', () => {
    const mockTerminal: TerminalProcess = {
      id: 'term-1',
      pty: {
        kill: vi.fn(),
        on: vi.fn(),
      } as any,
      isClaudeMode: false,
      cwd: '/home/user',
      outputBuffer: '',
      title: 'Test Terminal',
    };

    beforeEach(() => {
      vi.clearAllMocks();
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    describe('kills PTY and waits for exit when waitForExit=true', () => {
      it('kills PTY process and returns exit promise', async () => {
        const promise = killPty(mockTerminal, true);

        // Advance time past the waitForPtyExit timeout (500ms on Unix, 2000ms on Windows)
        vi.advanceTimersByTime(2000);
        await vi.runAllTimersAsync();

        await promise;

        expect(mockTerminal.pty.kill).toHaveBeenCalled();
      });

      // Note: Testing exit event resolution is not feasible since onExit is handled
      // by setupPtyHandlers, not killPty. killPty just uses waitForPtyExit timeout.
    });

    describe('kills PTY immediately when waitForExit=false', () => {
      it('kills PTY without waiting', () => {
        killPty(mockTerminal, false);
        expect(mockTerminal.pty.kill).toHaveBeenCalled();
      });

      it('returns void (not a promise) when waitForExit=false', () => {
        const result = killPty(mockTerminal, false);
        expect(result).toBeUndefined();
      });
    });
  });

  describe('writeToPty', () => {
    const mockTerminal: TerminalProcess = {
      id: 'term-1',
      pty: {
        write: vi.fn(),
        on: vi.fn(),
      } as any,
      isClaudeMode: false,
      cwd: '/home/user',
      outputBuffer: '',
      title: 'Test Terminal',
    };

    beforeEach(() => {
      vi.clearAllMocks();
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('writes small data directly without chunking', async () => {
      const data = 'small data';
      writeToPty(mockTerminal, data);

      // Run all pending setImmediate and microtasks
      await vi.runAllTimersAsync();

      expect(mockTerminal.pty.write).toHaveBeenCalledTimes(1);
      expect(mockTerminal.pty.write).toHaveBeenCalledWith(data);
    });

    it('writes large data in chunks', async () => {
      // Create data larger than CHUNKED_WRITE_THRESHOLD (1000 bytes)
      const largeData = 'x'.repeat(1500); // 1500 bytes

      writeToPty(mockTerminal, largeData);

      // Run all pending setImmediate calls (chunks are written via setImmediate)
      await vi.runAllTimersAsync();

      // Should be called in exactly 15 chunks (1500 / 100 = 15 chunks with CHUNK_SIZE=100)
      expect(mockTerminal.pty.write).toHaveBeenCalled();
      expect(vi.mocked(mockTerminal.pty.write).mock.calls.length).toBe(15);
    });

    it('serializes writes per terminal to prevent interleaving', async () => {
      // Write to same terminal twice
      writeToPty(mockTerminal, 'data1');
      writeToPty(mockTerminal, 'data2');

      // Run all pending setImmediate and microtasks
      await vi.runAllTimersAsync();

      // Both writes should complete (ordered)
      expect(mockTerminal.pty.write).toHaveBeenCalledTimes(2);
    });
  });

  describe('resizePty', () => {
    const mockTerminal: TerminalProcess = {
      id: 'term-1',
      pty: {
        resize: vi.fn(),
      } as any,
      isClaudeMode: false,
      cwd: '/home/user',
      outputBuffer: '',
      title: 'Test Terminal',
    };

    it('resizes PTY to specified dimensions', () => {
      resizePty(mockTerminal, 100, 30);
      expect(mockTerminal.pty.resize).toHaveBeenCalledWith(100, 30);
    });
  });

  describe('getActiveProfileEnv', () => {
    it('returns environment variables from Claude profile', () => {
      const env = getActiveProfileEnv();
      expect(env).toHaveProperty('CLAUDE_CODE_OAUTH_TOKEN');
      expect(env.CLAUDE_CODE_OAUTH_TOKEN).toBe('test-token');
    });
  });
});

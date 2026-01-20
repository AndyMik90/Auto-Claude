/**
 * Shell Escape Utilities Tests
 *
 * Tests for shell command escaping utilities to prevent command injection.
 * Tests platform-specific behavior for Windows cmd.exe vs Unix shells.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  escapeShellArg,
  escapeShellPath,
  buildCdCommand,
  escapeShellArgWindows,
  escapeForWindowsDoubleQuote,
  isPathSafe,
  parseFileReferenceDrop
} from './shell-escape';

// Mock the platform module
vi.mock('../platform', () => ({
  isWindows: vi.fn(() => false),
  isMacOS: vi.fn(() => false),
  isLinux: vi.fn(() => false),
  getCurrentPlatform: vi.fn(() => 'linux'),
}));

import { isWindows } from '../platform';
const mockIsWindows = vi.mocked(isWindows);

describe('shell-escape', () => {
  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('escapeShellArg', () => {
    it('wraps simple strings in single quotes', () => {
      expect(escapeShellArg('hello')).toBe("'hello'");
    });

    it('preserves spaces inside quotes', () => {
      expect(escapeShellArg('hello world')).toBe("'hello world'");
    });

    it('escapes embedded single quotes', () => {
      expect(escapeShellArg("it's")).toBe("'it'\\''s'");
    });

    it('prevents command substitution', () => {
      expect(escapeShellArg('$(rm -rf /)')).toBe("'$(rm -rf /)'");
    });

    it('prevents backtick command substitution', () => {
      expect(escapeShellArg('`whoami`')).toBe("'`whoami`'");
    });

    it('handles pipes and other metacharacters', () => {
      expect(escapeShellArg('test"; rm -rf / #')).toBe("'test\"; rm -rf / #'");
    });

    it('handles empty strings', () => {
      expect(escapeShellArg('')).toBe("''");
    });

    it('handles special characters', () => {
      expect(escapeShellArg('$PATH')).toBe("'$PATH'");
      expect(escapeShellArg('user@host')).toBe("'user@host'");
    });
  });

  describe('escapeShellPath', () => {
    it('uses same escaping as escapeShellArg', () => {
      const path = '/path/to/file';
      expect(escapeShellPath(path)).toBe(escapeShellArg(path));
    });

    it('handles paths with spaces', () => {
      expect(escapeShellPath('/path/with spaces/file')).toBe("'/path/with spaces/file'");
    });

    it('handles paths with single quotes', () => {
      expect(escapeShellPath("/path/it's/file")).toBe("'/path/it'\\''s/file'");
    });
  });

  describe('buildCdCommand', () => {
    describe('on Windows', () => {
      beforeEach(() => {
        mockIsWindows.mockReturnValue(true);
      });

      it('returns cd /d with double quotes for cmd', () => {
        const result = buildCdCommand('C:\\Projects\\MyApp');
        expect(result).toContain('cd /d');
        expect(result).toContain('"C:\\Projects\\MyApp"');
        expect(result).toContain(' && ');
      });

      it('uses semicolon separator for PowerShell', () => {
        const result = buildCdCommand('C:\\Projects\\MyApp', 'powershell');
        expect(result).toContain('; ');
        expect(result).not.toContain(' && ');
      });

      it('escapes double quotes in path for cmd', () => {
        const result = buildCdCommand('C:\\My "Project"');
        expect(result).toContain('""');
      });

      it('escapes percent signs in path', () => {
        const result = buildCdCommand('C:\\%PATH%\\dir');
        expect(result).toContain('%%');
      });

      it('removes newlines from path', () => {
        const result = buildCdCommand('C:\\Project\nWith\\Newlines');
        expect(result).not.toContain('\n');
      });

      it('returns empty string for undefined path', () => {
        expect(buildCdCommand(undefined)).toBe('');
      });

      it('returns empty string for empty path', () => {
        expect(buildCdCommand('')).toBe('');
      });
    });

    describe('on Unix', () => {
      beforeEach(() => {
        mockIsWindows.mockReturnValue(false);
      });

      it('returns cd with single quotes and &&', () => {
        const result = buildCdCommand('/home/user/project');
        expect(result).toBe("cd '/home/user/project' && ");
      });

      it('handles paths with spaces', () => {
        const result = buildCdCommand('/home/user/my project');
        expect(result).toBe("cd '/home/user/my project' && ");
      });

      it('handles paths with single quotes', () => {
        const result = buildCdCommand("/home/user/it's project");
        expect(result).toContain("'\\''");
      });

      it('returns empty string for undefined path', () => {
        expect(buildCdCommand(undefined)).toBe('');
      });
    });

    describe('on Linux', () => {
      beforeEach(() => {
        mockIsWindows.mockReturnValue(false);
      });

      it('uses same format as macOS', () => {
        const result = buildCdCommand('/home/user/project');
        expect(result).toBe("cd '/home/user/project' && ");
      });
    });
  });

  describe('escapeShellArgWindows', () => {
    it('escapes ampersands', () => {
      expect(escapeShellArgWindows('Company & Co')).toBe('Company ^& Co');
    });

    it('escapes pipes', () => {
      expect(escapeShellArgWindows('a|b')).toBe('a^|b');
    });

    it('escapes less than and greater than', () => {
      expect(escapeShellArgWindows('a<b>c')).toBe('a^<b^>c');
    });

    it('escapes double quotes', () => {
      expect(escapeShellArgWindows('say "hello"')).toBe('say ^"hello^"');
    });

    it('escapes carets', () => {
      expect(escapeShellArgWindows('a^b')).toBe('a^^b');
    });

    it('escapes percent signs', () => {
      expect(escapeShellArgWindows('%PATH%')).toBe('%%PATH%%');
    });

    it('removes newlines', () => {
      expect(escapeShellArgWindows('line1\nline2')).toBe('line1line2');
    });

    it('removes carriage returns', () => {
      expect(escapeShellArgWindows('line1\rline2')).toBe('line1line2');
    });

    it('handles mixed special characters', () => {
      expect(escapeShellArgWindows('echo "hello" & echo "world"'))
        .toBe('echo ^"hello^" ^& echo ^"world^"');
    });

    it('handles empty strings', () => {
      expect(escapeShellArgWindows('')).toBe('');
    });
  });

  describe('escapeForWindowsDoubleQuote', () => {
    it('escapes double quotes by doubling', () => {
      expect(escapeForWindowsDoubleQuote('say "hello"')).toBe('say ""hello""');
    });

    it('escapes percent signs', () => {
      expect(escapeForWindowsDoubleQuote('%PATH%')).toBe('%%PATH%%');
    });

    it('removes newlines', () => {
      expect(escapeForWindowsDoubleQuote('line1\nline2')).toBe('line1line2');
    });

    it('removes carriage returns', () => {
      expect(escapeForWindowsDoubleQuote('line1\rline2')).toBe('line1line2');
    });

    it('does not escape ampersands (safe inside double quotes)', () => {
      expect(escapeForWindowsDoubleQuote('Company & Co')).toBe('Company & Co');
    });

    it('does not escape pipes (safe inside double quotes)', () => {
      expect(escapeForWindowsDoubleQuote('a|b')).toBe('a|b');
    });

    it('does not escape carets (literal inside double quotes)', () => {
      expect(escapeForWindowsDoubleQuote('a^b')).toBe('a^b');
    });

    it('handles mixed special characters', () => {
      expect(escapeForWindowsDoubleQuote('C:\\My "Path" & %VAR%'))
        .toBe('C:\\My ""Path"" & %%VAR%%');
    });

    it('handles empty strings', () => {
      expect(escapeForWindowsDoubleQuote('')).toBe('');
    });

    it('preserves single quotes', () => {
      expect(escapeForWindowsDoubleQuote("it's")).toBe("it's");
    });
  });

  describe('isPathSafe', () => {
    it('accepts normal paths', () => {
      expect(isPathSafe('/home/user/project')).toBe(true);
      expect(isPathSafe('C:\\Projects\\MyApp')).toBe(true);
      expect(isPathSafe('./relative/path')).toBe(true);
    });

    it('rejects command substitution $(...)', () => {
      expect(isPathSafe('$(rm -rf /)')).toBe(false);
      expect(isPathSafe('/path/$(whoami)/file')).toBe(false);
    });

    it('rejects backtick command substitution', () => {
      expect(isPathSafe('`whoami`')).toBe(false);
      expect(isPathSafe('/path/`date`/file')).toBe(false);
    });

    it('rejects pipes', () => {
      expect(isPathSafe('cat | evil')).toBe(false);
    });

    it('rejects command separators', () => {
      expect(isPathSafe('cd /; rm -rf /')).toBe(false);
      expect(isPathSafe('cd / && rm -rf /')).toBe(false);
    });

    it('rejects output redirection', () => {
      expect(isPathSafe('file > /etc/passwd')).toBe(false);
      expect(isPathSafe('cat < input')).toBe(false);
    });

    it('rejects newlines', () => {
      expect(isPathSafe('path\nwith\nnewlines')).toBe(false);
    });

    it('rejects carriage returns', () => {
      expect(isPathSafe('path\rwith\rcr')).toBe(false);
    });

    it('accepts special characters that are safe in paths', () => {
      expect(isPathSafe('path-with-dashes')).toBe(true);
      expect(isPathSafe('path_with_underscores')).toBe(true);
      expect(isPathSafe('path.with.dots')).toBe(true);
      expect(isPathSafe('path@with@at')).toBe(true);
      expect(isPathSafe('path with spaces')).toBe(true);
    });
  });

  describe('parseFileReferenceDrop', () => {
    it('parses valid file reference data', () => {
      const mockDataTransfer = {
        getData: vi.fn().mockReturnValue(JSON.stringify({
          type: 'file-reference',
          path: '/path/to/file.txt',
          name: 'file.txt',
          isDirectory: false
        }))
      } as unknown as DataTransfer;

      const result = parseFileReferenceDrop(mockDataTransfer);
      expect(result).toEqual({
        type: 'file-reference',
        path: '/path/to/file.txt',
        name: 'file.txt',
        isDirectory: false
      });
    });

    it('parses directory reference', () => {
      const mockDataTransfer = {
        getData: vi.fn().mockReturnValue(JSON.stringify({
          type: 'file-reference',
          path: '/path/to/folder',
          name: 'folder',
          isDirectory: true
        }))
      } as unknown as DataTransfer;

      const result = parseFileReferenceDrop(mockDataTransfer);
      expect(result?.isDirectory).toBe(true);
    });

    it('returns null for missing JSON data', () => {
      const mockDataTransfer = {
        getData: vi.fn().mockReturnValue('')
      } as unknown as DataTransfer;

      expect(parseFileReferenceDrop(mockDataTransfer)).toBeNull();
    });

    it('returns null for invalid JSON', () => {
      const mockDataTransfer = {
        getData: vi.fn().mockReturnValue('invalid json')
      } as unknown as DataTransfer;

      expect(parseFileReferenceDrop(mockDataTransfer)).toBeNull();
    });

    it('returns null for wrong type', () => {
      const mockDataTransfer = {
        getData: vi.fn().mockReturnValue(JSON.stringify({
          type: 'something-else',
          path: '/path/to/file'
        }))
      } as unknown as DataTransfer;

      expect(parseFileReferenceDrop(mockDataTransfer)).toBeNull();
    });

    it('returns null for missing path', () => {
      const mockDataTransfer = {
        getData: vi.fn().mockReturnValue(JSON.stringify({
          type: 'file-reference'
        }))
      } as unknown as DataTransfer;

      expect(parseFileReferenceDrop(mockDataTransfer)).toBeNull();
    });

    it('returns null for empty path', () => {
      const mockDataTransfer = {
        getData: vi.fn().mockReturnValue(JSON.stringify({
          type: 'file-reference',
          path: ''
        }))
      } as unknown as DataTransfer;

      expect(parseFileReferenceDrop(mockDataTransfer)).toBeNull();
    });

    it('fills in default values for optional fields', () => {
      const mockDataTransfer = {
        getData: vi.fn().mockReturnValue(JSON.stringify({
          type: 'file-reference',
          path: '/path/to/file'
        }))
      } as unknown as DataTransfer;

      const result = parseFileReferenceDrop(mockDataTransfer);
      expect(result).toEqual({
        type: 'file-reference',
        path: '/path/to/file',
        name: '',
        isDirectory: false
      });
    });

    it('handles non-string name field', () => {
      const mockDataTransfer = {
        getData: vi.fn().mockReturnValue(JSON.stringify({
          type: 'file-reference',
          path: '/path/to/file',
          name: 12345,
          isDirectory: 'true' as unknown as boolean
        }))
      } as unknown as DataTransfer;

      const result = parseFileReferenceDrop(mockDataTransfer);
      expect(result?.name).toBe('');
      expect(result?.isDirectory).toBe(false);
    });
  });
});

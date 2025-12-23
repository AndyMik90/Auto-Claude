/**
 * Tests for python-detector.ts
 * Specifically tests parsePythonCommand to handle paths with spaces
 */
import { describe, it, expect } from 'vitest';
import { parsePythonCommand, findPythonCommand, getDefaultPythonCommand } from '../python-detector';

describe('python-detector', () => {
  describe('parsePythonCommand', () => {
    it('should return simple command as-is with empty args', () => {
      const [cmd, args] = parsePythonCommand('python3');
      expect(cmd).toBe('python3');
      expect(args).toEqual([]);
    });

    it('should split space-separated commands like "py -3"', () => {
      const [cmd, args] = parsePythonCommand('py -3');
      expect(cmd).toBe('py');
      expect(args).toEqual(['-3']);
    });

    it('should handle Windows python launcher with version', () => {
      const [cmd, args] = parsePythonCommand('py -3.11');
      expect(cmd).toBe('py');
      expect(args).toEqual(['-3.11']);
    });

    it('should NOT split Unix absolute paths (starting with /)', () => {
      const path = '/usr/local/bin/python3';
      const [cmd, args] = parsePythonCommand(path);
      expect(cmd).toBe(path);
      expect(args).toEqual([]);
    });

    it('should NOT split paths containing spaces (macOS Application Support)', () => {
      // This is the critical regression test for the bug fix
      const path = '/Users/user/Library/Application Support/auto-claude-ui/python-venv/bin/python3';
      const [cmd, args] = parsePythonCommand(path);
      expect(cmd).toBe(path);
      expect(args).toEqual([]);
    });

    it('should NOT split Windows absolute paths (starting with drive letter)', () => {
      const path = 'C:\\Users\\user\\AppData\\Local\\Programs\\Python\\Python311\\python.exe';
      const [cmd, args] = parsePythonCommand(path);
      expect(cmd).toBe(path);
      expect(args).toEqual([]);
    });

    it('should NOT split Windows paths with forward slashes', () => {
      const path = 'C:/Users/user/AppData/Local/Programs/Python/Python311/python.exe';
      const [cmd, args] = parsePythonCommand(path);
      expect(cmd).toBe(path);
      expect(args).toEqual([]);
    });

    it('should NOT split Windows paths with spaces', () => {
      // Windows paths can also have spaces
      const path = 'C:\\Program Files\\Python311\\python.exe';
      const [cmd, args] = parsePythonCommand(path);
      expect(cmd).toBe(path);
      expect(args).toEqual([]);
    });

    it('should handle lowercase drive letters', () => {
      const path = 'd:\\python\\python.exe';
      const [cmd, args] = parsePythonCommand(path);
      expect(cmd).toBe(path);
      expect(args).toEqual([]);
    });
  });

  describe('getDefaultPythonCommand', () => {
    it('should return python3 on non-Windows platforms', () => {
      // This test will pass on macOS/Linux
      if (process.platform !== 'win32') {
        expect(getDefaultPythonCommand()).toBe('python3');
      }
    });

    it('should return python on Windows', () => {
      // This test will pass on Windows
      if (process.platform === 'win32') {
        expect(getDefaultPythonCommand()).toBe('python');
      }
    });
  });

  describe('findPythonCommand', () => {
    it('should return a valid Python command or null', () => {
      const cmd = findPythonCommand();
      // Should either find Python or return null
      expect(cmd === null || typeof cmd === 'string').toBe(true);
    });

    it('should return a command that includes Python 3 if found', () => {
      const cmd = findPythonCommand();
      if (cmd) {
        // If a command is found, it should be a valid Python 3 candidate
        expect(['python', 'python3', 'py', 'py -3'].some(c => cmd.startsWith(c.split(' ')[0]))).toBe(true);
      }
    });
  });
});

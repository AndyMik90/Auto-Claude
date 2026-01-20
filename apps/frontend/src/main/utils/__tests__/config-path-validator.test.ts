/**
 * Config Path Validator Tests
 *
 * Tests for security validation of Claude profile config directory paths.
 * Prevents path traversal attacks.
 */

import { describe, it, expect, afterEach } from 'vitest';
import * as os from 'os';
import { isValidConfigDir } from '../config-path-validator';
import { isWindows } from '../../platform';

describe('config-path-validator', () => {
  const originalHome = os.homedir();

  afterEach(() => {
    // Reset to original home dir after each test
    // Note: We can't actually mock os.homedir(), but we can test with the real home dir
  });

  describe('valid paths', () => {
    it('accepts home directory with ~', () => {
      expect(isValidConfigDir('~')).toBe(true);
    });

    it('accepts default .claude config directory', () => {
      const claudeDir = `${originalHome}/.claude`;
      expect(isValidConfigDir(claudeDir)).toBe(true);
    });

    it('accepts .claude with ~ prefix', () => {
      expect(isValidConfigDir('~/.claude')).toBe(true);
    });

    it('accepts .claude-profiles directory', () => {
      const profilesDir = `${originalHome}/.claude-profiles`;
      expect(isValidConfigDir(profilesDir)).toBe(true);
    });

    it('accepts .claude-profiles with ~ prefix', () => {
      expect(isValidConfigDir('~/.claude-profiles')).toBe(true);
    });

    it('accepts profile subdirectory within .claude-profiles', () => {
      const profileDir = `${originalHome}/.claude-profiles/my-profile`;
      expect(isValidConfigDir(profileDir)).toBe(true);
    });

    it('accepts nested paths within home directory', () => {
      const nestedDir = `${originalHome}/some/nested/path/config`;
      expect(isValidConfigDir(nestedDir)).toBe(true);
    });

    it('accepts exact home directory path', () => {
      expect(isValidConfigDir(originalHome)).toBe(true);
    });
  });

  describe('invalid paths - path traversal', () => {
    it('rejects ../ escaping home directory', () => {
      const maliciousPath = `${originalHome}/../etc`;
      expect(isValidConfigDir(maliciousPath)).toBe(false);
    });

    it('rejects absolute root paths', () => {
      expect(isValidConfigDir('/etc')).toBe(false);
      expect(isValidConfigDir('/usr/local')).toBe(false);
      expect(isValidConfigDir('/var/log')).toBe(false);
    });

    it('rejects system config directories', () => {
      expect(isValidConfigDir('/etc/claude')).toBe(false);
    });

    it('rejects other user home directories', () => {
      if (!isWindows()) {
        expect(isValidConfigDir('/home/otheruser/.claude')).toBe(false);
        expect(isValidConfigDir('/users/otheruser/.claude')).toBe(false);
      }
    });

    it('rejects path traversal with .. components', () => {
      const traversalPath = `${originalHome}/.claude/../../../etc`;
      expect(isValidConfigDir(traversalPath)).toBe(false);
    });
  });

  describe('invalid paths - suspicious patterns', () => {
    it('rejects Windows system directories', () => {
      if (isWindows()) {
        expect(isValidConfigDir('C:\\Windows\\System32\\config')).toBe(false);
        expect(isValidConfigDir('C:\\Program Files')).toBe(false);
      }
    });

    it('rejects /etc/passwd symlink targets', () => {
      expect(isValidConfigDir('/etc')).toBe(false);
    });
  });

  describe('edge cases', () => {
    it('rejects empty string', () => {
      expect(isValidConfigDir('')).toBe(false);
    });

    it('handles relative paths starting with .', () => {
      // Relative paths that resolve outside home dir should be rejected
      const relativePath = '../other-directory';
      expect(isValidConfigDir(relativePath)).toBe(false);
    });

    it('handles paths with trailing slashes', () => {
      const trailingSlash = `${originalHome}/.claude/`;
      expect(isValidConfigDir(trailingSlash)).toBe(true);
    });

    it('normalizes paths with . components', () => {
      const dotPath = `${originalHome}/./.claude`;
      expect(isValidConfigDir(dotPath)).toBe(true);
    });

    it('handles paths with multiple consecutive separators', () => {
      const doubleSep = `${originalHome}//.claude`;
      // Path normalization should handle this
      expect(isValidConfigDir(doubleSep)).toBe(true);
    });
  });

  describe('security - prefix boundary checking', () => {
    it('prevents prefix bypass with similar usernames', () => {
      // A path like /home/alice-malicious should not match /home/alice
      if (!isWindows()) {
        const maliciousDir = '/home/alice-malicious/.claude';

        // If alice directory exists, validate that alice-malicious doesn't pass
        // This test documents the security behavior
        expect(isValidConfigDir(maliciousDir)).toBe(false);
      }
    });

    it('prevents subdirectory bypass', () => {
      // /home/alice/subdir should not match just because it starts with /home/ali
      // The validation requires exact prefix match or prefix + separator
      const testPath = `${originalHome}/subdir/.claude`;
      expect(isValidConfigDir(testPath)).toBe(true); // This is valid - it's within home dir
    });
  });

  describe('cross-platform behavior', () => {
    it('handles both forward and backward separators on Windows', () => {
      if (isWindows()) {
        const forwardSlash = `${originalHome}/.claude`;
        const backslash = originalHome.replace(/\//g, '\\') + '\\.claude';
        expect(isValidConfigDir(forwardSlash)).toBe(true);
        expect(isValidConfigDir(backslash)).toBe(true);
      }
    });

    it('handles ~ expansion correctly', () => {
      // ~ should expand to the actual home directory
      expect(isValidConfigDir('~/.claude')).toBe(true);
    });
  });
});

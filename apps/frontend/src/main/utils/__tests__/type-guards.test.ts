/**
 * Type Guards Tests
 *
 * Tests for type guard functions.
 */

import { describe, it, expect } from 'vitest';
import { isNodeError } from '../type-guards';

describe('type-guards', () => {
  describe('isNodeError', () => {
    it('returns true for Error with code property', () => {
      const error = new Error('Test error');
      (error as NodeJS.ErrnoException).code = 'ENOENT';

      expect(isNodeError(error)).toBe(true);
    });

    it('returns false for Error without code property', () => {
      const error = new Error('Test error');

      expect(isNodeError(error)).toBe(false);
    });

    it('returns false for plain object', () => {
      const obj = { message: 'Not an error' };

      expect(isNodeError(obj)).toBe(false);
    });

    it('returns false for null', () => {
      expect(isNodeError(null)).toBe(false);
    });

    it('returns false for undefined', () => {
      expect(isNodeError(undefined)).toBe(false);
    });

    it('returns false for string', () => {
      expect(isNodeError('error string')).toBe(false);
    });

    it('returns false for number', () => {
      expect(isNodeError(42)).toBe(false);
    });

    it('narrows type to NodeJS.ErrnoException when true', () => {
      const error = new Error('File not found');
      (error as NodeJS.ErrnoException).code = 'ENOENT';

      if (isNodeError(error)) {
        // TypeScript should know error.code exists here
        expect(error.code).toBe('ENOENT');
        expect(error.code?.toUpperCase()).toBe('ENOENT');
      }
    });

    it.each([
      'ENOENT',
      'EEXIST',
      'EACCES',
      'EISDIR',
      'ENOTDIR',
      'EPIPE',
      'ETIMEDOUT',
      'EBUSY',
      'ENOTEMPTY',
      'ECONNREFUSED'
    ])('recognizes common error code: %s', (code) => {
      const error = new Error('Test');
      (error as NodeJS.ErrnoException).code = code;
      expect(isNodeError(error)).toBe(true);
    });

    it('handles empty string code', () => {
      const error = new Error('Test');
      (error as NodeJS.ErrnoException).code = '';

      expect(isNodeError(error)).toBe(true);
    });

    it('handles numeric code', () => {
      const error = new Error('Test');
      (error as NodeJS.ErrnoException).code = 404 as any;

      expect(isNodeError(error)).toBe(true);
    });
  });
});

/**
 * Sentry Privacy Utilities Tests
 *
 * Tests for path masking and privacy protection in error reports.
 */

import { describe, it, expect } from 'vitest';
import {
  maskUserPaths,
  processEvent,
  type SentryErrorEvent
} from '../sentry-privacy';

describe('sentry-privacy', () => {
  describe('maskUserPaths', () => {
    it('returns empty string as-is', () => {
      expect(maskUserPaths('')).toBe('');
    });

    it('returns undefined as-is', () => {
      expect(maskUserPaths(undefined as unknown as string)).toBeUndefined();
    });

    it('returns null as-is', () => {
      expect(maskUserPaths(null as unknown as string)).toBeNull();
    });

    it('masks macOS user paths with trailing slash', () => {
      const input = 'Error at /Users/alice/project/src/index.ts:42';
      const expected = 'Error at /Users/***/project/src/index.ts:42';
      expect(maskUserPaths(input)).toBe(expected);
    });

    it('masks macOS user paths without trailing slash', () => {
      const input = 'Path: /Users/bob';
      const expected = 'Path: /Users/***';
      expect(maskUserPaths(input)).toBe(expected);
    });

    it('masks Windows user paths with trailing backslash', () => {
      const input = 'Error at C:\\Users\\charlie\\project\\src\\index.ts:42';
      const expected = 'Error at C:\\Users\\***\\project\\src\\index.ts:42';
      expect(maskUserPaths(input)).toBe(expected);
    });

    it('masks Windows user paths without trailing backslash', () => {
      const input = 'Path: C:\\Users\\david';
      const expected = 'Path: C:\\Users\\***';
      expect(maskUserPaths(input)).toBe(expected);
    });

    it('masks Windows user paths case-insensitively', () => {
      const input = 'Error at c:\\users\\eve\\project\\file.ts';
      const expected = 'Error at c:\\Users\\***\\project\\file.ts';
      expect(maskUserPaths(input)).toBe(expected);
    });

    it('masks Windows with different drive letters', () => {
      const input = 'D:\\Users\\frank\\file.txt';
      const expected = 'D:\\Users\\***\\file.txt';
      expect(maskUserPaths(input)).toBe(expected);
    });

    it('masks Linux home paths with trailing slash', () => {
      const input = 'Error at /home/grace/project/src/index.ts:42';
      const expected = 'Error at /home/***/project/src/index.ts:42';
      expect(maskUserPaths(input)).toBe(expected);
    });

    it('masks Linux home paths without trailing slash', () => {
      const input = 'Path: /home/henry';
      const expected = 'Path: /home/***';
      expect(maskUserPaths(input)).toBe(expected);
    });

    it('masks multiple paths in same string', () => {
      const input = 'Copied from /Users/alice/file.ts to /Users/bob/file.ts';
      const expected = 'Copied from /Users/***/file.ts to /Users/***/file.ts';
      expect(maskUserPaths(input)).toBe(expected);
    });

    it('leaves project paths visible after user directory', () => {
      const input = 'Error: /Users/alice/my-project/src/utils/helper.ts';
      const expected = 'Error: /Users/***/my-project/src/utils/helper.ts';
      expect(maskUserPaths(input)).toBe(expected);
      // The project path "my-project/src/utils/helper.ts" should remain visible
    });

    it('handles strings without user paths', () => {
      const input = 'This is a regular error message';
      expect(maskUserPaths(input)).toBe(input);
    });

    it('handles mixed path formats', () => {
      const input = 'Paths: /Users/alice/file.ts and C:\\Users\\bob\\file.txt';
      const expected = 'Paths: /Users/***/file.ts and C:\\Users\\***\\file.txt';
      expect(maskUserPaths(input)).toBe(expected);
    });
  });

  describe('processEvent', () => {
    it('masks paths in exception stack trace frames', () => {
      const event: SentryErrorEvent = {
        exception: {
          values: [{
            stacktrace: {
              frames: [
                { filename: '/Users/alice/project/src/index.ts', abs_path: '/Users/alice/project/src/index.ts' },
                { filename: 'C:\\Users\\bob\\project\\file.ts', abs_path: 'C:\\Users\\bob\\project\\file.ts' },
              ]
            }
          }]
        }
      };

      const result = processEvent(event);

      expect(result.exception?.values?.[0].stacktrace?.frames?.[0].filename).toBe('/Users/***/project/src/index.ts');
      expect(result.exception?.values?.[0].stacktrace?.frames?.[1].filename).toBe('C:\\Users\\***\\project\\file.ts');
    });

    it('masks paths in exception value', () => {
      const event: SentryErrorEvent = {
        exception: {
          values: [{
            value: 'Error at /Users/alice/project/file.ts:42'
          }]
        }
      };

      const result = processEvent(event);

      expect(result.exception?.values?.[0].value).toBe('Error at /Users/***/project/file.ts:42');
    });

    it('masks paths in breadcrumbs', () => {
      const event: SentryErrorEvent = {
        breadcrumbs: [
          { message: 'Navigated to /Users/alice/dashboard', data: { path: '/Users/alice/dashboard' } },
        ]
      };

      const result = processEvent(event);

      expect(result.breadcrumbs?.[0].message).toBe('Navigated to /Users/***/dashboard');
      expect(result.breadcrumbs?.[0].data?.path).toBe('/Users/***/dashboard');
    });

    it('masks paths in message', () => {
      const event: SentryErrorEvent = {
        message: 'Failed to load C:\\Users\\charlie\\config.json'
      };

      const result = processEvent(event);

      expect(result.message).toBe('Failed to load C:\\Users\\***\\config.json');
    });

    it('masks paths in tags', () => {
      const event: SentryErrorEvent = {
        tags: {
          file_path: '/Users/alice/project/src/index.ts',
          user_home: '/home/bob'
        }
      };

      const result = processEvent(event);

      expect(result.tags?.file_path).toBe('/Users/***/project/src/index.ts');
      expect(result.tags?.user_home).toBe('/home/***');
    });

    it('masks paths in contexts', () => {
      const event: SentryErrorEvent = {
        contexts: {
          app: {
            file_path: '/Users/alice/project/src/index.ts',
            config_dir: '/home/bob/.config'
          } as Record<string, unknown>
        }
      };

      const result = processEvent(event);

      expect(result.contexts?.app?.file_path).toBe('/Users/***/project/src/index.ts');
      expect(result.contexts?.app?.config_dir).toBe('/home/***/.config');
    });

    it('masks paths in extra data', () => {
      const event: SentryErrorEvent = {
        extra: {
          paths: ['/Users/alice/project', '/home/bob/data'],
          user_dir: '/Users/charlie'
        }
      };

      const result = processEvent(event);

      expect(result.extra?.paths).toEqual(['/Users/***/project', '/home/***/data']);
      expect(result.extra?.user_dir).toBe('/Users/***');
    });

    it('clears user info', () => {
      const event: SentryErrorEvent = {
        user: {
          id: 'user-123',
          email: 'user@example.com',
          username: 'alice'
        }
      };

      const result = processEvent(event);

      expect(result.user).toEqual({});
    });

    it('masks paths in request URL', () => {
      const event: SentryErrorEvent = {
        request: {
          url: 'file:///Users/alice/project/index.html'
        }
      };

      const result = processEvent(event);

      expect(result.request?.url).toBe('file:///Users/***/project/index.html');
    });

    it('masks paths in request headers', () => {
      const event: SentryErrorEvent = {
        request: {
          headers: {
            referer: 'file:///Users/bob/page.html',
            'x-file-path': '/Users/alice/file.ts'
          }
        }
      };

      const result = processEvent(event);

      expect(result.request?.headers?.referer).toBe('file:///Users/***/page.html');
      expect(result.request?.headers?.['x-file-path']).toBe('/Users/***/file.ts');
    });

    it('masks paths in request data', () => {
      const event: SentryErrorEvent = {
        request: {
          data: {
            filePath: '/Users/alice/project/file.ts',
            nested: {
              path: '/home/bob/data'
            }
          }
        }
      };

      const result = processEvent(event);

      expect(result.request?.data).toEqual({
        filePath: '/Users/***/project/file.ts',
        nested: {
          path: '/home/***/data'
        }
      });
    });

    it('handles empty event', () => {
      const event: SentryErrorEvent = {};
      const result = processEvent(event);
      expect(result).toEqual({});
    });

    it('handles event with null values', () => {
      const event: SentryErrorEvent = {
        exception: undefined,
        breadcrumbs: undefined,
        message: null as unknown as string
      };

      const result = processEvent(event);

      expect(result.exception).toBeUndefined();
      expect(result.breadcrumbs).toBeUndefined();
      expect(result.message).toBeNull();
    });

    it('recursively masks nested objects in extra data', () => {
      const event: SentryErrorEvent = {
        extra: {
          nested: {
            deeply: {
              path: '/Users/alice/file.ts'
            }
          },
          array: [
            { path: '/Users/bob/file.ts' },
            { path: '/home/charlie/file.ts' }
          ]
        }
      };

      const result = processEvent(event);

      expect(result.extra?.nested).toEqual({
        deeply: {
          path: '/Users/***/file.ts'
        }
      });
      expect(result.extra?.array).toEqual([
        { path: '/Users/***/file.ts' },
        { path: '/home/***/file.ts' }
      ]);
    });
  });
});

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { IpcRenderer } from 'electron';

// Mock electron module with vi.fn() inside the factory
vi.mock('electron', () => ({
  ipcRenderer: {
    send: vi.fn(),
    on: vi.fn(),
    removeListener: vi.fn()
  }
}));

// Import after mocking
import { createTaskAPI } from '../task-api';
import { ipcRenderer } from 'electron';

// Get references to the mocked functions
const mockSend = ipcRenderer.send as ReturnType<typeof vi.fn>;
const mockOn = ipcRenderer.on as ReturnType<typeof vi.fn>;
const mockRemoveListener = ipcRenderer.removeListener as ReturnType<typeof vi.fn>;

describe('TaskAPI - PR Creation IPC', () => {
  let taskAPI: ReturnType<typeof createTaskAPI>;

  beforeEach(() => {
    vi.clearAllMocks();
    taskAPI = createTaskAPI();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('createPR', () => {
    it('should send GITHUB_PR_CREATE event with correct parameters', () => {
      const projectId = 'test-project';
      const specDir = '/path/to/spec';
      const base = 'main';
      const head = 'feature-branch';
      const title = 'Test PR';
      const body = 'PR description';
      const draft = false;

      taskAPI.createPR(projectId, specDir, base, head, title, body, draft);

      expect(mockSend).toHaveBeenCalledWith(
        'github:pr:create',
        projectId,
        specDir,
        base,
        head,
        title,
        body,
        draft
      );
    });

    it('should default draft to false if not provided', () => {
      taskAPI.createPR('proj', '/spec', 'main', 'feat', 'title', 'body');

      expect(mockSend).toHaveBeenCalledWith(
        'github:pr:create',
        'proj',
        '/spec',
        'main',
        'feat',
        'title',
        'body',
        false
      );
    });

    it('should send draft=true when explicitly set', () => {
      taskAPI.createPR('proj', '/spec', 'main', 'feat', 'title', 'body', true);

      expect(mockSend).toHaveBeenCalledWith(
        'github:pr:create',
        'proj',
        '/spec',
        'main',
        'feat',
        'title',
        'body',
        true
      );
    });

    it('should not return a promise (fire and forget)', () => {
      const result = taskAPI.createPR('proj', '/spec', 'main', 'feat', 'title', 'body');

      expect(result).toBeUndefined();
    });
  });

  describe('onPRCreateProgress', () => {
    it('should register event listener on correct channel', () => {
      const callback = vi.fn();

      taskAPI.onPRCreateProgress(callback);

      expect(mockOn).toHaveBeenCalledWith(
        'github:pr:createProgress',
        expect.any(Function)
      );
    });

    it('should call callback with progress data', () => {
      const callback = vi.fn();
      let handler: ((...args: any[]) => void) | undefined;

      mockOn.mockImplementation((channel, fn) => {
        if (channel === 'github:pr:createProgress') {
          handler = fn;
        }
      });

      taskAPI.onPRCreateProgress(callback);

      // Simulate event emission
      const progressData = { progress: 50, message: 'Pushing to remote' };
      handler?.({} as any, progressData);

      expect(callback).toHaveBeenCalledWith(progressData);
    });

    it('should return cleanup function', () => {
      const cleanup = taskAPI.onPRCreateProgress(vi.fn());

      expect(cleanup).toBeInstanceOf(Function);
    });

    it('should remove listener when cleanup is called', () => {
      const callback = vi.fn();
      let handler: ((...args: any[]) => void) | undefined;

      mockOn.mockImplementation((channel, fn) => {
        if (channel === 'github:pr:createProgress') {
          handler = fn;
        }
      });

      const cleanup = taskAPI.onPRCreateProgress(callback);
      cleanup();

      expect(mockRemoveListener).toHaveBeenCalledWith(
        'github:pr:createProgress',
        handler
      );
    });

    it('should handle multiple progress events', () => {
      const callback = vi.fn();
      let handler: ((...args: any[]) => void) | undefined;

      mockOn.mockImplementation((channel, fn) => {
        if (channel === 'github:pr:createProgress') {
          handler = fn;
        }
      });

      taskAPI.onPRCreateProgress(callback);

      // Emit multiple events
      handler?.({} as any, { progress: 10, message: 'Starting' });
      handler?.({} as any, { progress: 50, message: 'Halfway' });
      handler?.({} as any, { progress: 100, message: 'Complete' });

      expect(callback).toHaveBeenCalledTimes(3);
      expect(callback).toHaveBeenNthCalledWith(1, { progress: 10, message: 'Starting' });
      expect(callback).toHaveBeenNthCalledWith(2, { progress: 50, message: 'Halfway' });
      expect(callback).toHaveBeenNthCalledWith(3, { progress: 100, message: 'Complete' });
    });
  });

  describe('onPRCreateComplete', () => {
    it('should register event listener on correct channel', () => {
      const callback = vi.fn();

      taskAPI.onPRCreateComplete(callback);

      expect(mockOn).toHaveBeenCalledWith(
        'github:pr:createComplete',
        expect.any(Function)
      );
    });

    it('should call callback with PR result', () => {
      const callback = vi.fn();
      let handler: ((...args: any[]) => void) | undefined;

      mockOn.mockImplementation((channel, fn) => {
        if (channel === 'github:pr:createComplete') {
          handler = fn;
        }
      });

      taskAPI.onPRCreateComplete(callback);

      // Simulate successful PR creation
      const result = { number: 42, url: 'https://github.com/test/pr/42', title: 'Test PR', state: 'open' };
      handler?.({} as any, result);

      expect(callback).toHaveBeenCalledWith(result);
    });

    it('should return cleanup function', () => {
      const cleanup = taskAPI.onPRCreateComplete(vi.fn());

      expect(cleanup).toBeInstanceOf(Function);
    });

    it('should remove listener when cleanup is called', () => {
      const callback = vi.fn();
      let handler: ((...args: any[]) => void) | undefined;

      mockOn.mockImplementation((channel, fn) => {
        if (channel === 'github:pr:createComplete') {
          handler = fn;
        }
      });

      const cleanup = taskAPI.onPRCreateComplete(callback);
      cleanup();

      expect(mockRemoveListener).toHaveBeenCalledWith(
        'github:pr:createComplete',
        handler
      );
    });

    it('should handle PR with all required fields', () => {
      const callback = vi.fn();
      let handler: ((...args: any[]) => void) | undefined;

      mockOn.mockImplementation((channel, fn) => {
        if (channel === 'github:pr:createComplete') {
          handler = fn;
        }
      });

      taskAPI.onPRCreateComplete(callback);

      const result = {
        number: 123,
        url: 'https://github.com/owner/repo/pull/123',
        title: 'Add new feature',
        state: 'open'
      };

      handler?.({} as any, result);

      expect(callback).toHaveBeenCalledWith(result);
      expect(callback.mock.calls[0][0]).toHaveProperty('number', 123);
      expect(callback.mock.calls[0][0]).toHaveProperty('url');
      expect(callback.mock.calls[0][0]).toHaveProperty('title');
      expect(callback.mock.calls[0][0]).toHaveProperty('state');
    });
  });

  describe('onPRCreateError', () => {
    it('should register event listener on correct channel', () => {
      const callback = vi.fn();

      taskAPI.onPRCreateError(callback);

      expect(mockOn).toHaveBeenCalledWith(
        'github:pr:createError',
        expect.any(Function)
      );
    });

    it('should call callback with error message', () => {
      const callback = vi.fn();
      let handler: ((...args: any[]) => void) | undefined;

      mockOn.mockImplementation((channel, fn) => {
        if (channel === 'github:pr:createError') {
          handler = fn;
        }
      });

      taskAPI.onPRCreateError(callback);

      // Simulate error
      const error = 'Failed to create PR: GitHub API error';
      handler?.({} as any, error);

      expect(callback).toHaveBeenCalledWith(error);
    });

    it('should return cleanup function', () => {
      const cleanup = taskAPI.onPRCreateError(vi.fn());

      expect(cleanup).toBeInstanceOf(Function);
    });

    it('should remove listener when cleanup is called', () => {
      const callback = vi.fn();
      let handler: ((...args: any[]) => void) | undefined;

      mockOn.mockImplementation((channel, fn) => {
        if (channel === 'github:pr:createError') {
          handler = fn;
        }
      });

      const cleanup = taskAPI.onPRCreateError(callback);
      cleanup();

      expect(mockRemoveListener).toHaveBeenCalledWith(
        'github:pr:createError',
        handler
      );
    });

    it('should handle different error types', () => {
      const callback = vi.fn();
      let handler: ((...args: any[]) => void) | undefined;

      mockOn.mockImplementation((channel, fn) => {
        if (channel === 'github:pr:createError') {
          handler = fn;
        }
      });

      taskAPI.onPRCreateError(callback);

      // Test various error scenarios
      handler?.({} as any, 'Network error');
      handler?.({} as any, 'Authentication failed');
      handler?.({} as any, 'Invalid branch name');

      expect(callback).toHaveBeenCalledTimes(3);
      expect(callback).toHaveBeenNthCalledWith(1, 'Network error');
      expect(callback).toHaveBeenNthCalledWith(2, 'Authentication failed');
      expect(callback).toHaveBeenNthCalledWith(3, 'Invalid branch name');
    });
  });

  describe('Full PR Creation Flow', () => {
    it('should handle complete success flow', () => {
      const progressCallback = vi.fn();
      const completeCallback = vi.fn();
      const errorCallback = vi.fn();

      let progressHandler: ((...args: any[]) => void) | undefined;
      let completeHandler: ((...args: any[]) => void) | undefined;
      let errorHandler: ((...args: any[]) => void) | undefined;

      mockOn.mockImplementation((channel, fn) => {
        if (channel === 'github:pr:createProgress') progressHandler = fn;
        if (channel === 'github:pr:createComplete') completeHandler = fn;
        if (channel === 'github:pr:createError') errorHandler = fn;
      });

      // Setup listeners
      const cleanupProgress = taskAPI.onPRCreateProgress(progressCallback);
      const cleanupComplete = taskAPI.onPRCreateComplete(completeCallback);
      const cleanupError = taskAPI.onPRCreateError(errorCallback);

      // Initiate PR creation
      taskAPI.createPR('proj', '/spec', 'main', 'feat', 'title', 'body');

      // Simulate progress events
      progressHandler?.({} as any, { progress: 10, message: 'Starting' });
      progressHandler?.({} as any, { progress: 50, message: 'Pushing' });
      progressHandler?.({} as any, { progress: 100, message: 'Creating PR' });

      // Simulate successful completion
      const result = { number: 42, url: 'https://github.com/test/pr/42', title: 'title', state: 'open' };
      completeHandler?.({} as any, result);

      // Verify flow
      expect(mockSend).toHaveBeenCalledWith('github:pr:create', 'proj', '/spec', 'main', 'feat', 'title', 'body', false);
      expect(progressCallback).toHaveBeenCalledTimes(3);
      expect(completeCallback).toHaveBeenCalledWith(result);
      expect(errorCallback).not.toHaveBeenCalled();

      // Cleanup
      cleanupProgress();
      cleanupComplete();
      cleanupError();

      expect(mockRemoveListener).toHaveBeenCalledTimes(3);
    });

    it('should handle error flow', () => {
      const progressCallback = vi.fn();
      const completeCallback = vi.fn();
      const errorCallback = vi.fn();

      let progressHandler: ((...args: any[]) => void) | undefined;
      let errorHandler: ((...args: any[]) => void) | undefined;

      mockOn.mockImplementation((channel, fn) => {
        if (channel === 'github:pr:createProgress') progressHandler = fn;
        if (channel === 'github:pr:createError') errorHandler = fn;
      });

      // Setup listeners
      taskAPI.onPRCreateProgress(progressCallback);
      taskAPI.onPRCreateComplete(completeCallback);
      taskAPI.onPRCreateError(errorCallback);

      // Initiate PR creation
      taskAPI.createPR('proj', '/spec', 'main', 'feat', 'title', 'body');

      // Simulate some progress
      progressHandler?.({} as any, { progress: 10, message: 'Starting' });

      // Simulate error
      errorHandler?.({} as any, 'GitHub API error');

      // Verify error flow
      expect(progressCallback).toHaveBeenCalledTimes(1);
      expect(errorCallback).toHaveBeenCalledWith('GitHub API error');
      expect(completeCallback).not.toHaveBeenCalled();
    });

    it('should handle cleanup properly in success scenario', () => {
      let progressHandler: ((...args: any[]) => void) | undefined;
      let completeHandler: ((...args: any[]) => void) | undefined;
      let errorHandler: ((...args: any[]) => void) | undefined;

      mockOn.mockImplementation((channel, fn) => {
        if (channel === 'github:pr:createProgress') progressHandler = fn;
        if (channel === 'github:pr:createComplete') completeHandler = fn;
        if (channel === 'github:pr:createError') errorHandler = fn;
      });

      const cleanupProgress = taskAPI.onPRCreateProgress(vi.fn());
      const cleanupComplete = taskAPI.onPRCreateComplete(vi.fn());
      const cleanupError = taskAPI.onPRCreateError(vi.fn());

      // All three listeners should be registered
      expect(mockOn).toHaveBeenCalledTimes(3);

      // Clean them all up
      cleanupProgress();
      cleanupComplete();
      cleanupError();

      // All three should be removed
      expect(mockRemoveListener).toHaveBeenCalledTimes(3);
      expect(mockRemoveListener).toHaveBeenCalledWith('github:pr:createProgress', progressHandler);
      expect(mockRemoveListener).toHaveBeenCalledWith('github:pr:createComplete', completeHandler);
      expect(mockRemoveListener).toHaveBeenCalledWith('github:pr:createError', errorHandler);
    });
  });

  describe('Event Channel Names', () => {
    it('should use correct channel constant for createPR', () => {
      taskAPI.createPR('p', 's', 'b', 'h', 't', 'body');

      expect(mockSend).toHaveBeenCalledWith(
        'github:pr:create',
        expect.anything(),
        expect.anything(),
        expect.anything(),
        expect.anything(),
        expect.anything(),
        expect.anything(),
        expect.anything()
      );
    });

    it('should use correct channel constant for onPRCreateProgress', () => {
      taskAPI.onPRCreateProgress(vi.fn());

      expect(mockOn).toHaveBeenCalledWith(
        'github:pr:createProgress',
        expect.any(Function)
      );
    });

    it('should use correct channel constant for onPRCreateComplete', () => {
      taskAPI.onPRCreateComplete(vi.fn());

      expect(mockOn).toHaveBeenCalledWith(
        'github:pr:createComplete',
        expect.any(Function)
      );
    });

    it('should use correct channel constant for onPRCreateError', () => {
      taskAPI.onPRCreateError(vi.fn());

      expect(mockOn).toHaveBeenCalledWith(
        'github:pr:createError',
        expect.any(Function)
      );
    });
  });
});

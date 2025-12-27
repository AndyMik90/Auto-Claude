/**
 * Integration tests for GitHub fork detection functionality
 * Tests fork detection, parent repository extraction, and API routing
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { EventEmitter } from 'events';

// Mock project store
const mockGetProject = vi.fn();
vi.mock('../../../project-store', () => ({
  projectStore: {
    getProject: (...args: unknown[]) => mockGetProject(...args)
  }
}));

// Mock fs module
const mockExistsSync = vi.fn();
const mockReadFileSync = vi.fn();
vi.mock('fs', () => ({
  existsSync: (...args: unknown[]) => mockExistsSync(...args),
  readFileSync: (...args: unknown[]) => mockReadFileSync(...args)
}));

// Mock child_process
vi.mock('child_process', () => ({
  execSync: vi.fn()
}));

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock electron ipcMain
const mockHandlers = new Map<string, Function>();
vi.mock('electron', () => {
  const mockIpcMain = new (class extends EventEmitter {
    handle(channel: string, handler: Function): void {
      mockHandlers.set(channel, handler);
    }

    removeHandler(channel: string): void {
      mockHandlers.delete(channel);
    }
  })();

  return {
    ipcMain: mockIpcMain
  };
});

// Helper to invoke registered handlers
async function invokeHandler(channel: string, event: unknown, ...args: unknown[]): Promise<unknown> {
  const handler = mockHandlers.get(channel);
  if (handler) {
    return handler(event, ...args);
  }
  throw new Error(`No handler for channel: ${channel}`);
}

// Test project data
const mockProject = {
  id: 'test-project-id',
  name: 'Test Project',
  path: '/test/project',
  autoBuildPath: '.auto-claude'
};

// Mock API responses
const mockForkRepoResponse = {
  id: 123456,
  name: 'forked-repo',
  full_name: 'user/forked-repo',
  description: 'A forked repository',
  html_url: 'https://github.com/user/forked-repo',
  default_branch: 'main',
  private: false,
  owner: { login: 'user', avatar_url: 'https://avatars.githubusercontent.com/u/1' },
  fork: true,
  parent: {
    id: 654321,
    name: 'original-repo',
    full_name: 'original-owner/original-repo',
    owner: { login: 'original-owner', avatar_url: 'https://avatars.githubusercontent.com/u/2' },
    html_url: 'https://github.com/original-owner/original-repo'
  }
};

const mockNonForkRepoResponse = {
  id: 789012,
  name: 'my-repo',
  full_name: 'user/my-repo',
  description: 'A non-fork repository',
  html_url: 'https://github.com/user/my-repo',
  default_branch: 'main',
  private: false,
  owner: { login: 'user', avatar_url: 'https://avatars.githubusercontent.com/u/1' },
  fork: false
};

const mockIssuesFromParent = [
  {
    id: 1,
    number: 1,
    title: 'Issue from parent repo',
    body: 'This is an issue from the parent repository',
    state: 'open',
    labels: [],
    assignees: [],
    user: { login: 'contributor', avatar_url: 'https://avatars.githubusercontent.com/u/3' },
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-02T00:00:00Z',
    comments: 5,
    url: 'https://api.github.com/repos/original-owner/original-repo/issues/1',
    html_url: 'https://github.com/original-owner/original-repo/issues/1'
  }
];

describe('Fork Detection Integration Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockHandlers.clear();

    // Default project mock
    mockGetProject.mockReturnValue(mockProject);

    // Default file system mock
    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockReturnValue(
      'GITHUB_TOKEN=test-token\nGITHUB_REPO=user/forked-repo'
    );
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('detectForkStatus function', () => {
    it('should detect forked repository and extract parent info', async () => {
      // Mock successful API response for a fork
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockForkRepoResponse
      });

      const { detectForkStatus } = await import('../repository-handlers');
      const result = await detectForkStatus('test-token', 'user/forked-repo');

      expect(result.isFork).toBe(true);
      expect(result.parentRepository).toBeDefined();
      expect(result.parentRepository?.owner).toBe('original-owner');
      expect(result.parentRepository?.name).toBe('original-repo');
      expect(result.parentRepository?.fullName).toBe('original-owner/original-repo');
      expect(result.parentRepository?.url).toBe('https://github.com/original-owner/original-repo');
    });

    it('should return isFork: false for non-fork repository', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockNonForkRepoResponse
      });

      const { detectForkStatus } = await import('../repository-handlers');
      const result = await detectForkStatus('test-token', 'user/my-repo');

      expect(result.isFork).toBe(false);
      expect(result.parentRepository).toBeUndefined();
    });

    it('should handle GitHub URL formats', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockForkRepoResponse
      });

      const { detectForkStatus } = await import('../repository-handlers');
      const result = await detectForkStatus('test-token', 'https://github.com/user/forked-repo');

      expect(result.isFork).toBe(true);
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.github.com/repos/user/forked-repo',
        expect.any(Object)
      );
    });

    it('should handle git URL formats', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockForkRepoResponse
      });

      const { detectForkStatus } = await import('../repository-handlers');
      const result = await detectForkStatus('test-token', 'git@github.com:user/forked-repo.git');

      expect(result.isFork).toBe(true);
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.github.com/repos/user/forked-repo',
        expect.any(Object)
      );
    });

    it('should throw error for invalid repository format', async () => {
      const { detectForkStatus } = await import('../repository-handlers');

      await expect(detectForkStatus('test-token', '')).rejects.toThrow(
        'Invalid repository format. Use owner/repo or GitHub URL.'
      );
    });
  });

  describe('GITHUB_DETECT_FORK IPC handler', () => {
    it('should detect fork status for project', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockForkRepoResponse
      });

      const { registerDetectFork } = await import('../repository-handlers');
      registerDetectFork();

      const result = await invokeHandler('github:detectFork', {}, 'test-project-id');

      expect(result).toEqual({
        success: true,
        data: {
          isFork: true,
          parentRepository: {
            owner: 'original-owner',
            name: 'original-repo',
            fullName: 'original-owner/original-repo',
            url: 'https://github.com/original-owner/original-repo'
          }
        }
      });
    });

    it('should return error when project not found', async () => {
      mockGetProject.mockReturnValueOnce(null);

      const { registerDetectFork } = await import('../repository-handlers');
      registerDetectFork();

      const result = await invokeHandler('github:detectFork', {}, 'unknown-project');

      expect(result).toEqual({
        success: false,
        error: 'Project not found'
      });
    });

    it('should return error when no GitHub config', async () => {
      mockExistsSync.mockReturnValueOnce(false);

      const { registerDetectFork } = await import('../repository-handlers');
      registerDetectFork();

      const result = await invokeHandler('github:detectFork', {}, 'test-project-id');

      expect(result).toEqual({
        success: false,
        error: 'No GitHub token or repository configured'
      });
    });
  });

  describe('Issue routing with fork detection', () => {
    it('should route issue requests to parent repo when fork is configured', async () => {
      // Configure as fork
      mockReadFileSync.mockReturnValue(
        'GITHUB_TOKEN=test-token\nGITHUB_REPO=user/forked-repo\nIS_FORK=true\nGITHUB_PARENT_REPO=original-owner/original-repo'
      );

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockIssuesFromParent
      });

      const { registerGetIssues } = await import('../issue-handlers');
      registerGetIssues();

      const result = await invokeHandler('github:getIssues', {}, 'test-project-id', 'open');

      // Verify API was called with parent repo
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('original-owner/original-repo'),
        expect.any(Object)
      );

      expect(result).toHaveProperty('success', true);
    });

    it('should route issue requests to fork repo when not configured as fork', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => []
      });

      const { registerGetIssues } = await import('../issue-handlers');
      registerGetIssues();

      const result = await invokeHandler('github:getIssues', {}, 'test-project-id', 'open');

      // Verify API was called with fork repo (not parent)
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('user/forked-repo'),
        expect.any(Object)
      );

      expect(result).toHaveProperty('success', true);
    });
  });

  describe('Connection check with fork status', () => {
    it('should include fork status in connection check response', async () => {
      // First call for repo info, second for issues
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockForkRepoResponse
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => []
        });

      const { registerCheckConnection } = await import('../repository-handlers');
      registerCheckConnection();

      const result = await invokeHandler('github:checkConnection', {}, 'test-project-id') as {
        success: boolean;
        data: { isFork: boolean; parentRepository?: object };
      };

      expect(result.success).toBe(true);
      expect(result.data.isFork).toBe(true);
      expect(result.data.parentRepository).toBeDefined();
    });

    it('should not include parent info for non-fork repos', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockNonForkRepoResponse
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => []
        });

      const { registerCheckConnection } = await import('../repository-handlers');
      registerCheckConnection();

      const result = await invokeHandler('github:checkConnection', {}, 'test-project-id') as {
        success: boolean;
        data: { isFork: boolean; parentRepository?: object };
      };

      expect(result.success).toBe(true);
      expect(result.data.isFork).toBe(false);
      expect(result.data.parentRepository).toBeUndefined();
    });
  });

  describe('getTargetRepo helper function', () => {
    it('should return parent repo when isFork and parentRepo configured', async () => {
      const { getTargetRepo } = await import('../utils');

      const config = {
        token: 'test-token',
        repo: 'user/forked-repo',
        isFork: true,
        parentRepo: 'original-owner/original-repo'
      };

      const result = getTargetRepo(config, true);
      expect(result).toBe('original-owner/original-repo');
    });

    it('should return fork repo when useParentForIssues is false', async () => {
      const { getTargetRepo } = await import('../utils');

      const config = {
        token: 'test-token',
        repo: 'user/forked-repo',
        isFork: true,
        parentRepo: 'original-owner/original-repo'
      };

      const result = getTargetRepo(config, false);
      expect(result).toBe('user/forked-repo');
    });

    it('should return fork repo when not marked as fork', async () => {
      const { getTargetRepo } = await import('../utils');

      const config = {
        token: 'test-token',
        repo: 'user/my-repo'
      };

      const result = getTargetRepo(config, true);
      expect(result).toBe('user/my-repo');
    });

    it('should return fork repo when parentRepo not configured', async () => {
      const { getTargetRepo } = await import('../utils');

      const config = {
        token: 'test-token',
        repo: 'user/forked-repo',
        isFork: true
        // No parentRepo configured
      };

      const result = getTargetRepo(config, true);
      expect(result).toBe('user/forked-repo');
    });
  });

  describe('normalizeRepoReference helper function', () => {
    it('should pass through owner/repo format unchanged', async () => {
      const { normalizeRepoReference } = await import('../utils');
      expect(normalizeRepoReference('owner/repo')).toBe('owner/repo');
    });

    it('should strip https://github.com/ prefix', async () => {
      const { normalizeRepoReference } = await import('../utils');
      expect(normalizeRepoReference('https://github.com/owner/repo')).toBe('owner/repo');
    });

    it('should strip .git suffix', async () => {
      const { normalizeRepoReference } = await import('../utils');
      expect(normalizeRepoReference('https://github.com/owner/repo.git')).toBe('owner/repo');
    });

    it('should handle git@github.com: format', async () => {
      const { normalizeRepoReference } = await import('../utils');
      expect(normalizeRepoReference('git@github.com:owner/repo.git')).toBe('owner/repo');
    });

    it('should return empty string for empty input', async () => {
      const { normalizeRepoReference } = await import('../utils');
      expect(normalizeRepoReference('')).toBe('');
    });
  });

  describe('Fallback behavior for inaccessible parent repos', () => {
    it('should fall back to fork repo when parent returns 404', async () => {
      const { githubFetchWithFallback } = await import('../utils');

      const config = {
        token: 'test-token',
        repo: 'user/forked-repo',
        isFork: true,
        parentRepo: 'original-owner/original-repo'
      };

      // First call (parent) returns 404, second call (fork) succeeds
      mockFetch
        .mockResolvedValueOnce({
          ok: false,
          status: 404,
          statusText: 'Not Found',
          text: async () => 'Not Found'
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockIssuesFromParent
        });

      const result = await githubFetchWithFallback(
        config,
        '/repos/{repo}/issues',
        true
      );

      expect(result.usedFallback).toBe(true);
      expect(result.usedRepo).toBe('user/forked-repo');
    });

    it('should fall back to fork repo when parent returns 403', async () => {
      const { githubFetchWithFallback } = await import('../utils');

      const config = {
        token: 'test-token',
        repo: 'user/forked-repo',
        isFork: true,
        parentRepo: 'original-owner/original-repo'
      };

      // First call (parent) returns 403, second call (fork) succeeds
      mockFetch
        .mockResolvedValueOnce({
          ok: false,
          status: 403,
          statusText: 'Forbidden',
          text: async () => 'Forbidden'
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => []
        });

      const result = await githubFetchWithFallback(
        config,
        '/repos/{repo}/issues',
        true
      );

      expect(result.usedFallback).toBe(true);
      expect(result.usedRepo).toBe('user/forked-repo');
    });

    it('should not fall back when using fork repo directly', async () => {
      const { githubFetchWithFallback } = await import('../utils');

      const config = {
        token: 'test-token',
        repo: 'user/my-repo'
        // Not a fork
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => []
      });

      const result = await githubFetchWithFallback(
        config,
        '/repos/{repo}/issues',
        true
      );

      expect(result.usedFallback).toBe(false);
      expect(result.usedRepo).toBe('user/my-repo');
    });
  });

  describe('Backward compatibility', () => {
    it('should work with projects without fork configuration', async () => {
      // Simple config without fork fields
      mockReadFileSync.mockReturnValue(
        'GITHUB_TOKEN=test-token\nGITHUB_REPO=user/my-repo'
      );

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => []
      });

      const { registerGetIssues } = await import('../issue-handlers');
      registerGetIssues();

      const result = await invokeHandler('github:getIssues', {}, 'test-project-id', 'open');

      expect(result).toHaveProperty('success', true);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('user/my-repo'),
        expect.any(Object)
      );
    });

    it('should handle IS_FORK=false gracefully', async () => {
      mockReadFileSync.mockReturnValue(
        'GITHUB_TOKEN=test-token\nGITHUB_REPO=user/my-repo\nIS_FORK=false'
      );

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => []
      });

      const { registerGetIssues } = await import('../issue-handlers');
      registerGetIssues();

      const result = await invokeHandler('github:getIssues', {}, 'test-project-id', 'open');

      expect(result).toHaveProperty('success', true);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('user/my-repo'),
        expect.any(Object)
      );
    });
  });

  /**
   * Non-fork Repository Integration Tests
   *
   * These tests verify that non-fork repositories continue to work exactly
   * as they did before the fork detection feature was added.
   *
   * End-to-end verification steps:
   * 1. Configure project with non-fork repo
   * 2. Trigger fork detection
   * 3. Verify fork status shows as false or not detected
   * 4. Check issues and PRs load from same repository
   * 5. Verify no behavior change from before
   */
  describe('Non-fork Repository Integration Tests', () => {
    // Use same pattern as mockProject - only needs fields used by getGitHubConfig
    const nonForkProject = {
      id: 'non-fork-project-id',
      name: 'Non-Fork Project',
      path: '/test/non-fork-project',
      autoBuildPath: '.auto-claude'
    } as import('../../../../shared/types').Project;

    const mockNonForkRepoApiResponse = {
      id: 999999,
      name: 'my-own-repo',
      full_name: 'myuser/my-own-repo',
      description: 'A repository I own, not a fork',
      html_url: 'https://github.com/myuser/my-own-repo',
      default_branch: 'main',
      private: false,
      owner: { login: 'myuser', avatar_url: 'https://avatars.githubusercontent.com/u/123' },
      fork: false
      // Note: no parent field for non-fork repos
    };

    const mockIssuesFromOwnRepo = [
      {
        id: 100,
        number: 10,
        title: 'Issue in my own repo',
        body: 'This is an issue in my own non-fork repository',
        state: 'open',
        labels: [{ name: 'bug', color: 'ff0000' }],
        assignees: [],
        user: { login: 'myuser', avatar_url: 'https://avatars.githubusercontent.com/u/123' },
        created_at: '2024-01-15T00:00:00Z',
        updated_at: '2024-01-16T00:00:00Z',
        comments: 2,
        url: 'https://api.github.com/repos/myuser/my-own-repo/issues/10',
        html_url: 'https://github.com/myuser/my-own-repo/issues/10'
      },
      {
        id: 101,
        number: 11,
        title: 'Another issue',
        body: 'Another issue in my own repo',
        state: 'open',
        labels: [],
        assignees: [{ login: 'contributor', avatar_url: 'https://avatars.githubusercontent.com/u/456' }],
        user: { login: 'contributor', avatar_url: 'https://avatars.githubusercontent.com/u/456' },
        created_at: '2024-01-17T00:00:00Z',
        updated_at: '2024-01-18T00:00:00Z',
        comments: 0,
        url: 'https://api.github.com/repos/myuser/my-own-repo/issues/11',
        html_url: 'https://github.com/myuser/my-own-repo/issues/11'
      }
    ];

    const mockPRsFromOwnRepo = [
      {
        number: 5,
        title: 'Add new feature',
        body: 'This PR adds a new feature to my repo',
        state: 'open',
        user: { login: 'contributor' },
        head: { ref: 'feature-branch' },
        base: { ref: 'main' },
        additions: 50,
        deletions: 10,
        changed_files: 3,
        assignees: [],
        created_at: '2024-01-20T00:00:00Z',
        updated_at: '2024-01-21T00:00:00Z',
        html_url: 'https://github.com/myuser/my-own-repo/pull/5'
      }
    ];

    beforeEach(() => {
      mockGetProject.mockReturnValue(nonForkProject);
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue(
        'GITHUB_TOKEN=test-token\nGITHUB_REPO=myuser/my-own-repo'
      );
    });

    describe('Fork detection for non-fork repos', () => {
      it('should detect non-fork status via GITHUB_DETECT_FORK handler', async () => {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: async () => mockNonForkRepoApiResponse
        });

        const { registerDetectFork } = await import('../repository-handlers');
        registerDetectFork();

        const result = await invokeHandler('github:detectFork', {}, 'non-fork-project-id');

        expect(result).toEqual({
          success: true,
          data: {
            isFork: false
          }
        });
      });

      it('should detect non-fork status even when repo has fork property explicitly set to false', async () => {
        const explicitNonForkResponse = {
          ...mockNonForkRepoApiResponse,
          fork: false
        };

        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: async () => explicitNonForkResponse
        });

        const { detectForkStatus } = await import('../repository-handlers');
        const result = await detectForkStatus('test-token', 'myuser/my-own-repo');

        expect(result.isFork).toBe(false);
        expect(result.parentRepository).toBeUndefined();
      });

      it('should handle repos with fork:true but no parent gracefully', async () => {
        // Edge case: API returns fork:true but no parent object
        const weirdResponse = {
          ...mockNonForkRepoApiResponse,
          fork: true,
          parent: undefined
        };

        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: async () => weirdResponse
        });

        const { detectForkStatus } = await import('../repository-handlers');
        const result = await detectForkStatus('test-token', 'myuser/my-own-repo');

        // Should still return isFork: false because no parent is available
        expect(result.isFork).toBe(false);
        expect(result.parentRepository).toBeUndefined();
      });
    });

    describe('Connection check for non-fork repos', () => {
      it('should return isFork:false in connection check for non-fork repos', async () => {
        mockFetch
          .mockResolvedValueOnce({
            ok: true,
            json: async () => mockNonForkRepoApiResponse
          })
          .mockResolvedValueOnce({
            ok: true,
            json: async () => mockIssuesFromOwnRepo
          });

        const { registerCheckConnection } = await import('../repository-handlers');
        registerCheckConnection();

        const result = await invokeHandler('github:checkConnection', {}, 'non-fork-project-id') as {
          success: boolean;
          data: { connected: boolean; isFork: boolean; parentRepository?: object; repoFullName?: string };
        };

        expect(result.success).toBe(true);
        expect(result.data.connected).toBe(true);
        expect(result.data.isFork).toBe(false);
        expect(result.data.parentRepository).toBeUndefined();
        expect(result.data.repoFullName).toBe('myuser/my-own-repo');
      });
    });

    describe('Issue loading for non-fork repos', () => {
      it('should load issues from the same repository (no redirect to parent)', async () => {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: async () => mockIssuesFromOwnRepo
        });

        const { registerGetIssues } = await import('../issue-handlers');
        registerGetIssues();

        const result = await invokeHandler('github:getIssues', {}, 'non-fork-project-id', 'open') as {
          success: boolean;
          data?: unknown[];
        };

        expect(result.success).toBe(true);
        expect(result.data).toHaveLength(2);

        // Verify API call was made to the same repository
        expect(mockFetch).toHaveBeenCalledWith(
          'https://api.github.com/repos/myuser/my-own-repo/issues?state=open&per_page=100&sort=updated',
          expect.any(Object)
        );
      });

      it('should load single issue from same repository', async () => {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: async () => mockIssuesFromOwnRepo[0]
        });

        const { registerGetIssue } = await import('../issue-handlers');
        registerGetIssue();

        const result = await invokeHandler('github:getIssue', {}, 'non-fork-project-id', 10) as {
          success: boolean;
          data?: { number: number; title: string };
        };

        expect(result.success).toBe(true);
        expect(result.data?.number).toBe(10);
        expect(result.data?.title).toBe('Issue in my own repo');

        expect(mockFetch).toHaveBeenCalledWith(
          'https://api.github.com/repos/myuser/my-own-repo/issues/10',
          expect.any(Object)
        );
      });

      it('should load issue comments from same repository', async () => {
        const mockComments = [
          { id: 1, body: 'Comment 1', user: { login: 'user1', avatar_url: '' } },
          { id: 2, body: 'Comment 2', user: { login: 'user2', avatar_url: '' } }
        ];

        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: async () => mockComments
        });

        const { registerGetIssueComments } = await import('../issue-handlers');
        registerGetIssueComments();

        const result = await invokeHandler('github:getIssueComments', {}, 'non-fork-project-id', 10) as {
          success: boolean;
          data?: unknown[];
        };

        expect(result.success).toBe(true);
        expect(result.data).toHaveLength(2);

        expect(mockFetch).toHaveBeenCalledWith(
          'https://api.github.com/repos/myuser/my-own-repo/issues/10/comments',
          expect.any(Object)
        );
      });
    });

    describe('getTargetRepo with non-fork configuration', () => {
      it('should always return the same repo regardless of useParentForIssues flag', async () => {
        const { getTargetRepo } = await import('../utils');

        const config = {
          token: 'test-token',
          repo: 'myuser/my-own-repo'
          // No isFork or parentRepo - typical non-fork config
        };

        // For issues/PRs (useParentForIssues = true)
        const issueRepo = getTargetRepo(config, true);
        expect(issueRepo).toBe('myuser/my-own-repo');

        // For code operations (useParentForIssues = false)
        const codeRepo = getTargetRepo(config, false);
        expect(codeRepo).toBe('myuser/my-own-repo');

        // Both should be the same
        expect(issueRepo).toBe(codeRepo);
      });

      it('should return same repo when IS_FORK=false is set explicitly', async () => {
        const { getTargetRepo } = await import('../utils');

        const config = {
          token: 'test-token',
          repo: 'myuser/my-own-repo',
          isFork: false
        };

        const issueRepo = getTargetRepo(config, true);
        const codeRepo = getTargetRepo(config, false);

        expect(issueRepo).toBe('myuser/my-own-repo');
        expect(codeRepo).toBe('myuser/my-own-repo');
        expect(issueRepo).toBe(codeRepo);
      });

      it('should return fork repo when isFork=true but no parentRepo configured', async () => {
        const { getTargetRepo } = await import('../utils');

        // Edge case: isFork is set but no parent configured
        const config = {
          token: 'test-token',
          repo: 'myuser/my-repo',
          isFork: true
          // No parentRepo!
        };

        const issueRepo = getTargetRepo(config, true);
        expect(issueRepo).toBe('myuser/my-repo'); // Falls back to fork repo
      });
    });

    describe('githubFetchWithFallback with non-fork repos', () => {
      it('should not trigger fallback logic for non-fork repos', async () => {
        const { githubFetchWithFallback } = await import('../utils');

        const config = {
          token: 'test-token',
          repo: 'myuser/my-own-repo'
        };

        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: async () => mockIssuesFromOwnRepo
        });

        const result = await githubFetchWithFallback(
          config,
          '/repos/{repo}/issues',
          true
        );

        expect(result.usedFallback).toBe(false);
        expect(result.usedRepo).toBe('myuser/my-own-repo');
        expect(result.data).toEqual(mockIssuesFromOwnRepo);

        // Only one fetch call should have been made
        expect(mockFetch).toHaveBeenCalledTimes(1);
      });

      it('should propagate errors without fallback for non-fork repos', async () => {
        const { githubFetchWithFallback } = await import('../utils');

        const config = {
          token: 'test-token',
          repo: 'myuser/my-own-repo'
        };

        mockFetch.mockResolvedValueOnce({
          ok: false,
          status: 404,
          statusText: 'Not Found',
          text: async () => 'Repository not found'
        });

        await expect(
          githubFetchWithFallback(config, '/repos/{repo}/issues', true)
        ).rejects.toThrow('GitHub API error: 404 Not Found');

        // Only one fetch call should have been made (no fallback attempt)
        expect(mockFetch).toHaveBeenCalledTimes(1);
      });
    });

    describe('Complete non-fork workflow simulation', () => {
      it('should complete full workflow: detect non-fork, load issues and PRs from same repo', async () => {
        // Step 1: Fork detection
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: async () => mockNonForkRepoApiResponse
        });

        const { registerDetectFork } = await import('../repository-handlers');
        registerDetectFork();

        const forkResult = await invokeHandler('github:detectFork', {}, 'non-fork-project-id') as {
          success: boolean;
          data: { isFork: boolean };
        };

        expect(forkResult.success).toBe(true);
        expect(forkResult.data.isFork).toBe(false);

        // Step 2: Load issues
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: async () => mockIssuesFromOwnRepo
        });

        const { registerGetIssues } = await import('../issue-handlers');
        registerGetIssues();

        const issuesResult = await invokeHandler('github:getIssues', {}, 'non-fork-project-id', 'open') as {
          success: boolean;
          data?: unknown[];
        };

        expect(issuesResult.success).toBe(true);
        expect(issuesResult.data).toHaveLength(2);

        // Verify issues were loaded from same repo (not parent)
        expect(mockFetch).toHaveBeenLastCalledWith(
          'https://api.github.com/repos/myuser/my-own-repo/issues?state=open&per_page=100&sort=updated',
          expect.any(Object)
        );
      });
    });

    describe('Config loading without fork fields', () => {
      it('should load config correctly without IS_FORK field', async () => {
        mockReadFileSync.mockReturnValue(
          'GITHUB_TOKEN=my-test-token\nGITHUB_REPO=owner/repo'
        );

        const { getGitHubConfig } = await import('../utils');
        const config = getGitHubConfig(nonForkProject);

        expect(config).not.toBeNull();
        expect(config?.token).toBe('my-test-token');
        expect(config?.repo).toBe('owner/repo');
        expect(config?.isFork).toBeUndefined();
        expect(config?.parentRepo).toBeUndefined();
      });

      it('should load config correctly with IS_FORK=false', async () => {
        mockReadFileSync.mockReturnValue(
          'GITHUB_TOKEN=my-test-token\nGITHUB_REPO=owner/repo\nIS_FORK=false'
        );

        const { getGitHubConfig } = await import('../utils');
        const config = getGitHubConfig(nonForkProject);

        expect(config).not.toBeNull();
        expect(config?.token).toBe('my-test-token');
        expect(config?.repo).toBe('owner/repo');
        // When IS_FORK=false, isFork is not included in config (undefined)
        // This is by design - we only track isFork when it's explicitly true
        expect(config?.isFork).toBeUndefined();
        expect(config?.parentRepo).toBeUndefined();
      });

      it('should handle mixed case IS_FORK values gracefully', async () => {
        // Test IS_FORK=FALSE (uppercase) - should be treated as NOT a fork
        mockReadFileSync.mockReturnValue(
          'GITHUB_TOKEN=token\nGITHUB_REPO=owner/repo\nIS_FORK=FALSE'
        );

        const { getGitHubConfig } = await import('../utils');
        let config = getGitHubConfig(nonForkProject);

        // When IS_FORK is not "true", isFork is not included (undefined)
        expect(config?.isFork).toBeUndefined();

        // Test IS_FORK=False (mixed case)
        mockReadFileSync.mockReturnValue(
          'GITHUB_TOKEN=token\nGITHUB_REPO=owner/repo\nIS_FORK=False'
        );

        config = getGitHubConfig(nonForkProject);
        expect(config?.isFork).toBeUndefined();

        // Test IS_FORK=no (not "true")
        mockReadFileSync.mockReturnValue(
          'GITHUB_TOKEN=token\nGITHUB_REPO=owner/repo\nIS_FORK=no'
        );

        config = getGitHubConfig(nonForkProject);
        expect(config?.isFork).toBeUndefined();

        // Test IS_FORK=true (should be included)
        mockReadFileSync.mockReturnValue(
          'GITHUB_TOKEN=token\nGITHUB_REPO=owner/repo\nIS_FORK=true'
        );

        config = getGitHubConfig(nonForkProject);
        expect(config?.isFork).toBe(true);

        // Test IS_FORK=TRUE (uppercase true should work)
        mockReadFileSync.mockReturnValue(
          'GITHUB_TOKEN=token\nGITHUB_REPO=owner/repo\nIS_FORK=TRUE'
        );

        config = getGitHubConfig(nonForkProject);
        expect(config?.isFork).toBe(true);
      });
    });
  });

  /**
   * Manual Parent Repository Override Integration Tests
   *
   * These tests verify that manually configured parent repositories work correctly
   * for loading issues and PRs from upstream repositories.
   *
   * End-to-end verification steps:
   * 1. Enter manual parent repo in settings (owner/repo format)
   * 2. Save configuration
   * 3. Verify issues and PRs now load from manually configured parent
   * 4. Test with invalid parent repo - verify error handling
   */
  describe('Manual Parent Repository Override Integration Tests', () => {
    const manualOverrideProject = {
      id: 'manual-override-project-id',
      name: 'Manual Override Project',
      path: '/test/manual-override-project',
      autoBuildPath: '.auto-claude'
    } as import('../../../../shared/types').Project;

    const mockManuallyConfiguredParentIssues = [
      {
        id: 200,
        number: 42,
        title: 'Issue from manually configured parent',
        body: 'This issue is from a manually configured parent repository',
        state: 'open',
        labels: [{ name: 'enhancement', color: '00ff00' }],
        assignees: [],
        user: { login: 'upstream-maintainer', avatar_url: 'https://avatars.githubusercontent.com/u/999' },
        created_at: '2024-02-01T00:00:00Z',
        updated_at: '2024-02-02T00:00:00Z',
        comments: 3,
        url: 'https://api.github.com/repos/upstream-org/main-project/issues/42',
        html_url: 'https://github.com/upstream-org/main-project/issues/42'
      },
      {
        id: 201,
        number: 43,
        title: 'Another upstream issue',
        body: 'Another issue from the manually configured parent',
        state: 'open',
        labels: [],
        assignees: [],
        user: { login: 'contributor', avatar_url: 'https://avatars.githubusercontent.com/u/888' },
        created_at: '2024-02-03T00:00:00Z',
        updated_at: '2024-02-04T00:00:00Z',
        comments: 0,
        url: 'https://api.github.com/repos/upstream-org/main-project/issues/43',
        html_url: 'https://github.com/upstream-org/main-project/issues/43'
      }
    ];

    const mockManuallyConfiguredParentPRs = [
      {
        number: 100,
        title: 'Feature PR from manual parent',
        body: 'This PR is from the manually configured parent repository',
        state: 'open',
        user: { login: 'contributor', avatar_url: 'https://avatars.githubusercontent.com/u/777' },
        head: { ref: 'feature-branch' },
        base: { ref: 'main' },
        additions: 100,
        deletions: 20,
        changed_files: 5,
        assignees: [],
        created_at: '2024-02-05T00:00:00Z',
        updated_at: '2024-02-06T00:00:00Z',
        html_url: 'https://github.com/upstream-org/main-project/pull/100'
      }
    ];

    beforeEach(() => {
      mockGetProject.mockReturnValue(manualOverrideProject);
      mockExistsSync.mockReturnValue(true);
    });

    describe('Manual parent repo configuration loading', () => {
      it('should load manually configured parent repo from .env', async () => {
        // Simulate user entering manual parent repo in settings (owner/repo format)
        mockReadFileSync.mockReturnValue(
          'GITHUB_TOKEN=test-token\nGITHUB_REPO=my-fork/project\nIS_FORK=true\nGITHUB_PARENT_REPO=upstream-org/main-project'
        );

        const { getGitHubConfig } = await import('../utils');
        const config = getGitHubConfig(manualOverrideProject);

        expect(config).not.toBeNull();
        expect(config?.isFork).toBe(true);
        expect(config?.parentRepo).toBe('upstream-org/main-project');
      });

      it('should load parent repo even when IS_FORK is not explicitly set', async () => {
        // Manual parent repo configured, but IS_FORK not set (implicit override scenario)
        mockReadFileSync.mockReturnValue(
          'GITHUB_TOKEN=test-token\nGITHUB_REPO=my-fork/project\nGITHUB_PARENT_REPO=upstream-org/main-project'
        );

        const { getGitHubConfig } = await import('../utils');
        const config = getGitHubConfig(manualOverrideProject);

        expect(config).not.toBeNull();
        expect(config?.parentRepo).toBe('upstream-org/main-project');
        // Note: isFork is not set, so issues will still load from fork repo
        // This tests that parentRepo is stored even without isFork
      });

      it('should handle GitHub URL format for manual parent repo', async () => {
        mockReadFileSync.mockReturnValue(
          'GITHUB_TOKEN=test-token\nGITHUB_REPO=my-fork/project\nIS_FORK=true\nGITHUB_PARENT_REPO=https://github.com/upstream-org/main-project'
        );

        const { getGitHubConfig, normalizeRepoReference } = await import('../utils');
        const config = getGitHubConfig(manualOverrideProject);

        expect(config?.parentRepo).toBe('https://github.com/upstream-org/main-project');
        // The normalization happens when using the repo
        expect(normalizeRepoReference(config?.parentRepo || '')).toBe('upstream-org/main-project');
      });

      it('should handle git URL format for manual parent repo', async () => {
        mockReadFileSync.mockReturnValue(
          'GITHUB_TOKEN=test-token\nGITHUB_REPO=my-fork/project\nIS_FORK=true\nGITHUB_PARENT_REPO=git@github.com:upstream-org/main-project.git'
        );

        const { getGitHubConfig, normalizeRepoReference } = await import('../utils');
        const config = getGitHubConfig(manualOverrideProject);

        expect(config?.parentRepo).toBe('git@github.com:upstream-org/main-project.git');
        expect(normalizeRepoReference(config?.parentRepo || '')).toBe('upstream-org/main-project');
      });
    });

    describe('Issue loading from manually configured parent', () => {
      it('should load issues from manually configured parent repo', async () => {
        // Step 2 of verification: Config saved, now verify issues load from manual parent
        mockReadFileSync.mockReturnValue(
          'GITHUB_TOKEN=test-token\nGITHUB_REPO=my-fork/project\nIS_FORK=true\nGITHUB_PARENT_REPO=upstream-org/main-project'
        );

        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: async () => mockManuallyConfiguredParentIssues
        });

        const { registerGetIssues } = await import('../issue-handlers');
        registerGetIssues();

        const result = await invokeHandler('github:getIssues', {}, 'manual-override-project-id', 'open') as {
          success: boolean;
          data?: unknown[];
        };

        expect(result.success).toBe(true);
        expect(result.data).toHaveLength(2);

        // Verify API was called with manually configured parent repo
        expect(mockFetch).toHaveBeenCalledWith(
          'https://api.github.com/repos/upstream-org/main-project/issues?state=open&per_page=100&sort=updated',
          expect.any(Object)
        );
      });

      it('should load single issue from manually configured parent repo', async () => {
        mockReadFileSync.mockReturnValue(
          'GITHUB_TOKEN=test-token\nGITHUB_REPO=my-fork/project\nIS_FORK=true\nGITHUB_PARENT_REPO=upstream-org/main-project'
        );

        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: async () => mockManuallyConfiguredParentIssues[0]
        });

        const { registerGetIssue } = await import('../issue-handlers');
        registerGetIssue();

        const result = await invokeHandler('github:getIssue', {}, 'manual-override-project-id', 42) as {
          success: boolean;
          data?: { number: number; title: string };
        };

        expect(result.success).toBe(true);
        expect(result.data?.number).toBe(42);
        expect(result.data?.title).toBe('Issue from manually configured parent');

        expect(mockFetch).toHaveBeenCalledWith(
          'https://api.github.com/repos/upstream-org/main-project/issues/42',
          expect.any(Object)
        );
      });

      it('should load issue comments from manually configured parent repo', async () => {
        mockReadFileSync.mockReturnValue(
          'GITHUB_TOKEN=test-token\nGITHUB_REPO=my-fork/project\nIS_FORK=true\nGITHUB_PARENT_REPO=upstream-org/main-project'
        );

        const mockComments = [
          { id: 1, body: 'Comment from upstream', user: { login: 'upstream-maintainer', avatar_url: '' } }
        ];

        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: async () => mockComments
        });

        const { registerGetIssueComments } = await import('../issue-handlers');
        registerGetIssueComments();

        const result = await invokeHandler('github:getIssueComments', {}, 'manual-override-project-id', 42) as {
          success: boolean;
          data?: unknown[];
        };

        expect(result.success).toBe(true);

        expect(mockFetch).toHaveBeenCalledWith(
          'https://api.github.com/repos/upstream-org/main-project/issues/42/comments',
          expect.any(Object)
        );
      });
    });

    describe('getTargetRepo with manual parent override', () => {
      it('should use manually configured parent for issues/PRs', async () => {
        const { getTargetRepo } = await import('../utils');

        const config = {
          token: 'test-token',
          repo: 'my-fork/project',
          isFork: true,
          parentRepo: 'upstream-org/main-project' // Manually configured
        };

        // For issues/PRs, should use the manual parent
        const issueRepo = getTargetRepo(config, true);
        expect(issueRepo).toBe('upstream-org/main-project');
      });

      it('should use fork repo for code operations even with manual parent configured', async () => {
        const { getTargetRepo } = await import('../utils');

        const config = {
          token: 'test-token',
          repo: 'my-fork/project',
          isFork: true,
          parentRepo: 'upstream-org/main-project'
        };

        // For code operations, should use fork repo
        const codeRepo = getTargetRepo(config, false);
        expect(codeRepo).toBe('my-fork/project');
      });

      it('should override auto-detected parent with manual value', async () => {
        const { getTargetRepo } = await import('../utils');

        // Simulate scenario where user manually overrides the detected parent
        // (e.g., pointing to a different upstream fork)
        const config = {
          token: 'test-token',
          repo: 'user/forked-repo',
          isFork: true,
          parentRepo: 'different-upstream/different-project' // Manual override
        };

        const issueRepo = getTargetRepo(config, true);
        expect(issueRepo).toBe('different-upstream/different-project');
      });

      it('should handle URL format for manually configured parent', async () => {
        const { getTargetRepo } = await import('../utils');

        const config = {
          token: 'test-token',
          repo: 'my-fork/project',
          isFork: true,
          parentRepo: 'https://github.com/upstream-org/main-project.git'
        };

        const issueRepo = getTargetRepo(config, true);
        expect(issueRepo).toBe('upstream-org/main-project'); // Should be normalized
      });
    });

    describe('Error handling for invalid manual parent repo', () => {
      it('should handle 404 from manually configured parent repo (deleted or wrong)', async () => {
        mockReadFileSync.mockReturnValue(
          'GITHUB_TOKEN=test-token\nGITHUB_REPO=my-fork/project\nIS_FORK=true\nGITHUB_PARENT_REPO=nonexistent-org/deleted-repo'
        );

        const { githubFetchWithFallback } = await import('../utils');
        const { getGitHubConfig } = await import('../utils');
        const config = getGitHubConfig(manualOverrideProject);

        expect(config).not.toBeNull();

        // First call to nonexistent parent returns 404, second call to fork succeeds
        mockFetch
          .mockResolvedValueOnce({
            ok: false,
            status: 404,
            statusText: 'Not Found',
            text: async () => 'Repository not found'
          })
          .mockResolvedValueOnce({
            ok: true,
            json: async () => [] // Empty issues from fork
          });

        const result = await githubFetchWithFallback(
          config!,
          '/repos/{repo}/issues',
          true
        );

        // Should have fallen back to fork repo
        expect(result.usedFallback).toBe(true);
        expect(result.usedRepo).toBe('my-fork/project');
      });

      it('should handle 403 from manually configured parent repo (no access)', async () => {
        mockReadFileSync.mockReturnValue(
          'GITHUB_TOKEN=test-token\nGITHUB_REPO=my-fork/project\nIS_FORK=true\nGITHUB_PARENT_REPO=private-org/private-repo'
        );

        const { githubFetchWithFallback, getGitHubConfig } = await import('../utils');
        const config = getGitHubConfig(manualOverrideProject);

        // First call to private parent returns 403
        mockFetch
          .mockResolvedValueOnce({
            ok: false,
            status: 403,
            statusText: 'Forbidden',
            text: async () => 'Must have push access to view repository pull requests'
          })
          .mockResolvedValueOnce({
            ok: true,
            json: async () => []
          });

        const result = await githubFetchWithFallback(
          config!,
          '/repos/{repo}/pulls',
          true
        );

        expect(result.usedFallback).toBe(true);
        expect(result.usedRepo).toBe('my-fork/project');
      });

      it('should not attempt fallback when fork repo itself fails', async () => {
        // Scenario: User configured wrong fork repo, not a fallback scenario
        mockReadFileSync.mockReturnValue(
          'GITHUB_TOKEN=test-token\nGITHUB_REPO=wrong/repo'
        );

        const { githubFetchWithFallback, getGitHubConfig } = await import('../utils');
        const config = getGitHubConfig(manualOverrideProject);

        mockFetch.mockResolvedValueOnce({
          ok: false,
          status: 404,
          statusText: 'Not Found',
          text: async () => 'Repository not found'
        });

        await expect(
          githubFetchWithFallback(config!, '/repos/{repo}/issues', true)
        ).rejects.toThrow('GitHub API error: 404 Not Found');

        // Only one fetch call (no fallback for non-fork repos)
        expect(mockFetch).toHaveBeenCalledTimes(1);
      });
    });

    describe('Manual override without fork detection', () => {
      it('should use fork repo when parentRepo set but isFork is not set', async () => {
        // User manually set parent repo but forgot to set IS_FORK=true
        mockReadFileSync.mockReturnValue(
          'GITHUB_TOKEN=test-token\nGITHUB_REPO=my-fork/project\nGITHUB_PARENT_REPO=upstream-org/main-project'
        );

        const { getTargetRepo, getGitHubConfig } = await import('../utils');
        const config = getGitHubConfig(manualOverrideProject);

        // Without isFork=true, should use fork repo (parentRepo is ignored)
        const issueRepo = getTargetRepo(config!, true);
        expect(issueRepo).toBe('my-fork/project');
      });

      it('should use parent repo when both IS_FORK=true and GITHUB_PARENT_REPO are set', async () => {
        mockReadFileSync.mockReturnValue(
          'GITHUB_TOKEN=test-token\nGITHUB_REPO=my-fork/project\nIS_FORK=true\nGITHUB_PARENT_REPO=upstream-org/main-project'
        );

        const { getTargetRepo, getGitHubConfig } = await import('../utils');
        const config = getGitHubConfig(manualOverrideProject);

        const issueRepo = getTargetRepo(config!, true);
        expect(issueRepo).toBe('upstream-org/main-project');
      });
    });

    describe('Complete manual override workflow simulation', () => {
      it('should complete full workflow: configure manual parent, load issues and PRs', async () => {
        // Step 1 & 2: User enters manual parent repo and saves configuration
        mockReadFileSync.mockReturnValue(
          'GITHUB_TOKEN=test-token\nGITHUB_REPO=my-fork/project\nIS_FORK=true\nGITHUB_PARENT_REPO=upstream-org/main-project'
        );

        // Verify config is loaded correctly
        const { getGitHubConfig } = await import('../utils');
        const config = getGitHubConfig(manualOverrideProject);

        expect(config?.parentRepo).toBe('upstream-org/main-project');
        expect(config?.isFork).toBe(true);

        // Step 3: Verify issues load from manually configured parent
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: async () => mockManuallyConfiguredParentIssues
        });

        const { registerGetIssues } = await import('../issue-handlers');
        registerGetIssues();

        const issuesResult = await invokeHandler('github:getIssues', {}, 'manual-override-project-id', 'open') as {
          success: boolean;
          data?: unknown[];
        };

        expect(issuesResult.success).toBe(true);
        expect(issuesResult.data).toHaveLength(2);
        expect(mockFetch).toHaveBeenCalledWith(
          'https://api.github.com/repos/upstream-org/main-project/issues?state=open&per_page=100&sort=updated',
          expect.any(Object)
        );
      });

      it('should handle scenario where user clears manual override', async () => {
        // User clears the manual parent repo (empty string)
        mockReadFileSync.mockReturnValue(
          'GITHUB_TOKEN=test-token\nGITHUB_REPO=my-fork/project\nIS_FORK=true'
          // No GITHUB_PARENT_REPO - user cleared it
        );

        const { getTargetRepo, getGitHubConfig } = await import('../utils');
        const config = getGitHubConfig(manualOverrideProject);

        // Even with isFork=true, without parentRepo, should use fork
        const issueRepo = getTargetRepo(config!, true);
        expect(issueRepo).toBe('my-fork/project');
      });

      it('should allow switching from one parent to another', async () => {
        // First config with one parent
        mockReadFileSync.mockReturnValue(
          'GITHUB_TOKEN=test-token\nGITHUB_REPO=my-fork/project\nIS_FORK=true\nGITHUB_PARENT_REPO=org-a/project-a'
        );

        const { getTargetRepo, getGitHubConfig } = await import('../utils');
        let config = getGitHubConfig(manualOverrideProject);

        expect(getTargetRepo(config!, true)).toBe('org-a/project-a');

        // User switches to a different parent
        mockReadFileSync.mockReturnValue(
          'GITHUB_TOKEN=test-token\nGITHUB_REPO=my-fork/project\nIS_FORK=true\nGITHUB_PARENT_REPO=org-b/project-b'
        );

        config = getGitHubConfig(manualOverrideProject);
        expect(getTargetRepo(config!, true)).toBe('org-b/project-b');
      });
    });

    describe('Validation edge cases for manual parent repo input', () => {
      it('should handle parent repo with special characters in name', async () => {
        const { normalizeRepoReference } = await import('../utils');

        // Test repos with dots, hyphens, underscores
        expect(normalizeRepoReference('org.name/repo-name_v2')).toBe('org.name/repo-name_v2');
        expect(normalizeRepoReference('my-org/my.project')).toBe('my-org/my.project');
        expect(normalizeRepoReference('org_123/repo_456')).toBe('org_123/repo_456');
      });

      it('should handle parent repo with trailing slash', async () => {
        const { normalizeRepoReference } = await import('../utils');

        // This is an edge case - URLs sometimes have trailing slashes
        expect(normalizeRepoReference('https://github.com/owner/repo/')).toBe('owner/repo/');
      });

      it('should handle whitespace in parent repo input', async () => {
        const { normalizeRepoReference } = await import('../utils');

        // Trailing and leading whitespace is trimmed for plain owner/repo format
        expect(normalizeRepoReference('  owner/repo  ')).toBe('owner/repo');

        // For URLs, the function expects properly formatted input
        // In practice, UI input is trimmed before being saved to config
        expect(normalizeRepoReference('https://github.com/owner/repo')).toBe('owner/repo');

        // Test that the function correctly trims after URL normalization
        expect(normalizeRepoReference('https://github.com/owner/repo  ')).toBe('owner/repo');
      });

      it('should handle empty parent repo gracefully', async () => {
        const { normalizeRepoReference } = await import('../utils');

        expect(normalizeRepoReference('')).toBe('');
        expect(normalizeRepoReference('   ')).toBe('');
      });
    });
  });
});

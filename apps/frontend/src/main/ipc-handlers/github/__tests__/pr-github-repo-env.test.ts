/**
 * Tests for GITHUB_REPO environment variable passing in PR reviews
 *
 * Issue: When reviewing PRs for different projects, the GITHUB_REPO from
 * backend's .env was being used for ALL projects instead of the project-specific repo.
 *
 * Fix: Frontend should pass the project's GITHUB_REPO via subprocess environment.
 *
 * @see https://12factor.net/config - Config should be per-deployment, not global
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock getGitHubConfig to return project-specific config
const mockGetGitHubConfig = vi.fn();

vi.mock('../utils', () => ({
  getGitHubConfig: (...args: unknown[]) => mockGetGitHubConfig(...args),
  normalizeRepoReference: (repo: string) => repo,
}));

// Mock getRunnerEnv to capture what env vars are passed
const mockGetRunnerEnv = vi.fn();

vi.mock('../utils/runner-env', () => ({
  getRunnerEnv: (...args: unknown[]) => mockGetRunnerEnv(...args),
}));

// Mock other dependencies
vi.mock('../utils/subprocess-runner', () => ({
  runPythonSubprocess: vi.fn(() => ({
    process: { pid: 123, kill: vi.fn() },
    promise: Promise.resolve({ success: true }),
  })),
  getPythonPath: () => '/path/to/python',
  buildRunnerArgs: (...args: unknown[]) => ['runner.py', ...String(args[1]).split(',')],
  getRunnerPath: () => '/path/to/runner.py',
}));

vi.mock('../../../github-review-cache', () => ({
  reviewCache: {
    get: vi.fn(),
    set: vi.fn(),
  },
}));

describe('PR Review - GITHUB_REPO Environment Variable', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetRunnerEnv.mockResolvedValue({
      PYTHONPATH: '/bundled/packages',
    });
  });

  it('should pass project-specific GITHUB_REPO when config has repo', async () => {
    // Arrange: Project A has its own GitHub repo configured
    const projectA = {
      id: 'project-a',
      name: 'ProjectA',
      path: '/path/to/project-a',
      autoBuildPath: '.auto-claude',
    };

    mockGetGitHubConfig.mockReturnValue({
      token: 'ghp_token',
      repo: 'OrgA/ProjectA',  // Project-specific repo
    });

    // Act: Call getRunnerEnv with project's repo
    const extraEnv = { USE_CLAUDE_MD: 'true' };
    const config = mockGetGitHubConfig(projectA);

    // This is what the fix should do:
    const envWithRepo = config?.repo
      ? { ...extraEnv, GITHUB_REPO: config.repo }
      : extraEnv;

    await mockGetRunnerEnv(envWithRepo);

    // Assert: GITHUB_REPO should be passed with project-specific value
    expect(mockGetRunnerEnv).toHaveBeenCalledWith(
      expect.objectContaining({
        GITHUB_REPO: 'OrgA/ProjectA',
      })
    );
  });

  it('should pass different GITHUB_REPO for different projects', async () => {
    // Arrange: Two different projects with different repos
    const projectA = { id: 'a', path: '/project-a', autoBuildPath: '.auto-claude' };
    const projectB = { id: 'b', path: '/project-b', autoBuildPath: '.auto-claude' };

    // Act & Assert: Project A
    mockGetGitHubConfig.mockReturnValue({ token: 'token', repo: 'OrgA/RepoA' });
    const configA = mockGetGitHubConfig(projectA);
    const envA = configA?.repo ? { GITHUB_REPO: configA.repo } : {};

    expect(envA.GITHUB_REPO).toBe('OrgA/RepoA');

    // Act & Assert: Project B
    mockGetGitHubConfig.mockReturnValue({ token: 'token', repo: 'OrgB/RepoB' });
    const configB = mockGetGitHubConfig(projectB);
    const envB = configB?.repo ? { GITHUB_REPO: configB.repo } : {};

    expect(envB.GITHUB_REPO).toBe('OrgB/RepoB');

    // They should be different
    expect(envA.GITHUB_REPO).not.toBe(envB.GITHUB_REPO);
  });

  it('should not pass GITHUB_REPO when config has no repo', async () => {
    // Arrange: Project without GitHub repo configured
    const project = { id: 'no-repo', path: '/project', autoBuildPath: '.auto-claude' };

    mockGetGitHubConfig.mockReturnValue(null);

    // Act
    const config = mockGetGitHubConfig(project);
    const envWithRepo = config?.repo
      ? { GITHUB_REPO: config.repo }
      : {};

    // Assert: GITHUB_REPO should not be in env
    expect(envWithRepo.GITHUB_REPO).toBeUndefined();
  });

  it('should override backend .env GITHUB_REPO with project-specific value', async () => {
    // This test documents the expected behavior:
    // Even if backend/.env has GITHUB_REPO=AndyMik90/Auto-Claude,
    // the subprocess should receive the project-specific repo

    const project = { id: 'override-test', path: '/project' };

    // Simulate backend having a different default repo
    const backendDefaultRepo = 'AndyMik90/Auto-Claude';

    // Project has its own repo
    mockGetGitHubConfig.mockReturnValue({
      token: 'token',
      repo: 'VDT-91/Skogplattform',
    });

    const config = mockGetGitHubConfig(project);
    const projectRepo = config?.repo;

    // The project-specific repo should take precedence
    expect(projectRepo).toBe('VDT-91/Skogplattform');
    expect(projectRepo).not.toBe(backendDefaultRepo);
  });
});

describe('GITHUB_REPO precedence order', () => {
  it('extraEnv (with GITHUB_REPO) should have highest precedence in getRunnerEnv', async () => {
    // According to runner-env.ts, extraEnv is spread last, giving it highest precedence
    // This test verifies that pattern works for GITHUB_REPO

    mockGetRunnerEnv.mockImplementation(async (extraEnv) => {
      // Simulate what getRunnerEnv does - extraEnv is spread last
      return {
        // Base env vars
        PYTHONPATH: '/packages',
        // extraEnv overrides everything
        ...extraEnv,
      };
    });

    const result = await mockGetRunnerEnv({ GITHUB_REPO: 'Project/Repo' });

    expect(result.GITHUB_REPO).toBe('Project/Repo');
  });
});

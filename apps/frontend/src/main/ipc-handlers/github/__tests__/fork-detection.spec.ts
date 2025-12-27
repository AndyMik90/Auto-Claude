/**
 * Unit tests for fork detection functionality
 * Tests getGitHubConfig parsing of IS_FORK and GITHUB_PARENT_REPO,
 * normalizeRepoReference URL handling, and target repo selection
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import path from 'path';

// Mock fs module
vi.mock('fs', () => ({
  existsSync: vi.fn(),
  readFileSync: vi.fn()
}));

// Mock child_process
vi.mock('child_process', () => ({
  execFileSync: vi.fn()
}));

// Mock cli-tool-manager
vi.mock('../../../cli-tool-manager', () => ({
  getToolPath: vi.fn().mockReturnValue('gh')
}));

// Mock env-utils
vi.mock('../../../env-utils', () => ({
  getAugmentedEnv: vi.fn().mockReturnValue(process.env)
}));

import { existsSync, readFileSync } from 'fs';
import { getGitHubConfig, normalizeRepoReference } from '../utils';
import type { Project } from '../../../../shared/types';

const mockExistsSync = existsSync as unknown as ReturnType<typeof vi.fn>;
const mockReadFileSync = readFileSync as unknown as ReturnType<typeof vi.fn>;

describe('Fork Detection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('getGitHubConfig - Fork Detection Fields', () => {
    // Create a minimal mock project with only the fields needed by getGitHubConfig
    const createMockProject = (autoBuildPath = '.auto-claude'): Project => ({
      id: 'test-project',
      name: 'Test Project',
      path: '/test/project',
      autoBuildPath,
      createdAt: new Date(),
      updatedAt: new Date(),
      settings: {
        model: 'claude-sonnet-4-20250514',
        memoryBackend: 'file',
        linearSync: false,
        notifications: {
          onTaskComplete: false,
          onTaskFailed: false,
          onReviewNeeded: false,
          sound: false
        },
        graphitiMcpEnabled: false
      }
    });

    it('should parse IS_FORK=true correctly', () => {
      const project = createMockProject();
      const envPath = path.join(project.path, project.autoBuildPath!, '.env');

      mockExistsSync.mockImplementation((p: string) => p === envPath);
      mockReadFileSync.mockImplementation((p: string) => {
        if (p === envPath) {
          return `GITHUB_TOKEN=test-token
GITHUB_REPO=owner/repo
IS_FORK=true
GITHUB_PARENT_REPO=parent-owner/parent-repo`;
        }
        return '';
      });

      const config = getGitHubConfig(project);

      expect(config).not.toBeNull();
      expect(config?.isFork).toBe(true);
      expect(config?.parentRepo).toBe('parent-owner/parent-repo');
    });

    it('should parse IS_FORK=TRUE (uppercase) correctly', () => {
      const project = createMockProject();
      const envPath = path.join(project.path, project.autoBuildPath!, '.env');

      mockExistsSync.mockImplementation((p: string) => p === envPath);
      mockReadFileSync.mockImplementation((p: string) => {
        if (p === envPath) {
          return `GITHUB_TOKEN=test-token
GITHUB_REPO=owner/repo
IS_FORK=TRUE
GITHUB_PARENT_REPO=parent-owner/parent-repo`;
        }
        return '';
      });

      const config = getGitHubConfig(project);

      expect(config).not.toBeNull();
      expect(config?.isFork).toBe(true);
    });

    it('should treat IS_FORK=false as false', () => {
      const project = createMockProject();
      const envPath = path.join(project.path, project.autoBuildPath!, '.env');

      mockExistsSync.mockImplementation((p: string) => p === envPath);
      mockReadFileSync.mockImplementation((p: string) => {
        if (p === envPath) {
          return `GITHUB_TOKEN=test-token
GITHUB_REPO=owner/repo
IS_FORK=false`;
        }
        return '';
      });

      const config = getGitHubConfig(project);

      expect(config).not.toBeNull();
      expect(config?.isFork).toBe(false);
    });

    it('should treat mixed case IS_FORK values (other than "true" or "TRUE") as false', () => {
      const project = createMockProject();
      const envPath = path.join(project.path, project.autoBuildPath!, '.env');

      mockExistsSync.mockImplementation((p: string) => p === envPath);
      mockReadFileSync.mockImplementation((p: string) => {
        if (p === envPath) {
          return `GITHUB_TOKEN=test-token
GITHUB_REPO=owner/repo
IS_FORK=True`;
        }
        return '';
      });

      const config = getGitHubConfig(project);

      expect(config).not.toBeNull();
      expect(config?.isFork).toBe(false);
    });

    it('should treat missing IS_FORK as false', () => {
      const project = createMockProject();
      const envPath = path.join(project.path, project.autoBuildPath!, '.env');

      mockExistsSync.mockImplementation((p: string) => p === envPath);
      mockReadFileSync.mockImplementation((p: string) => {
        if (p === envPath) {
          return `GITHUB_TOKEN=test-token
GITHUB_REPO=owner/repo`;
        }
        return '';
      });

      const config = getGitHubConfig(project);

      expect(config).not.toBeNull();
      expect(config?.isFork).toBe(false);
      expect(config?.parentRepo).toBeUndefined();
    });

    it('should treat empty GITHUB_PARENT_REPO as undefined', () => {
      const project = createMockProject();
      const envPath = path.join(project.path, project.autoBuildPath!, '.env');

      mockExistsSync.mockImplementation((p: string) => p === envPath);
      mockReadFileSync.mockImplementation((p: string) => {
        if (p === envPath) {
          return `GITHUB_TOKEN=test-token
GITHUB_REPO=owner/repo
IS_FORK=true
GITHUB_PARENT_REPO=`;
        }
        return '';
      });

      const config = getGitHubConfig(project);

      expect(config).not.toBeNull();
      expect(config?.isFork).toBe(true);
      expect(config?.parentRepo).toBeUndefined();
    });

    it('should normalize GitHub URL in GITHUB_PARENT_REPO', () => {
      const project = createMockProject();
      const envPath = path.join(project.path, project.autoBuildPath!, '.env');

      mockExistsSync.mockImplementation((p: string) => p === envPath);
      mockReadFileSync.mockImplementation((p: string) => {
        if (p === envPath) {
          return `GITHUB_TOKEN=test-token
GITHUB_REPO=owner/repo
IS_FORK=true
GITHUB_PARENT_REPO=https://github.com/parent-owner/parent-repo`;
        }
        return '';
      });

      const config = getGitHubConfig(project);

      expect(config).not.toBeNull();
      expect(config?.parentRepo).toBe('parent-owner/parent-repo');
    });

    it('should normalize git@ URL in GITHUB_PARENT_REPO', () => {
      const project = createMockProject();
      const envPath = path.join(project.path, project.autoBuildPath!, '.env');

      mockExistsSync.mockImplementation((p: string) => p === envPath);
      mockReadFileSync.mockImplementation((p: string) => {
        if (p === envPath) {
          return `GITHUB_TOKEN=test-token
GITHUB_REPO=owner/repo
IS_FORK=true
GITHUB_PARENT_REPO=git@github.com:parent-owner/parent-repo.git`;
        }
        return '';
      });

      const config = getGitHubConfig(project);

      expect(config).not.toBeNull();
      expect(config?.parentRepo).toBe('parent-owner/parent-repo');
    });

    it('should handle quoted values in .env file', () => {
      const project = createMockProject();
      const envPath = path.join(project.path, project.autoBuildPath!, '.env');

      mockExistsSync.mockImplementation((p: string) => p === envPath);
      mockReadFileSync.mockImplementation((p: string) => {
        if (p === envPath) {
          return `GITHUB_TOKEN="test-token"
GITHUB_REPO="owner/repo"
IS_FORK="true"
GITHUB_PARENT_REPO="parent-owner/parent-repo"`;
        }
        return '';
      });

      const config = getGitHubConfig(project);

      expect(config).not.toBeNull();
      expect(config?.isFork).toBe(true);
      expect(config?.parentRepo).toBe('parent-owner/parent-repo');
    });

    it('should return null if project has no autoBuildPath', () => {
      // Cast to unknown then to Project to test the null autoBuildPath edge case
      // This simulates projects that might have an empty or null autoBuildPath
      const project = {
        id: 'test-project',
        name: 'Test Project',
        path: '/test/project',
        autoBuildPath: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        settings: {
          model: 'claude-sonnet-4-20250514',
          memoryBackend: 'file',
          linearSync: false,
          notifications: {
            onTaskComplete: false,
            onTaskFailed: false,
            onReviewNeeded: false,
            sound: false
          },
          graphitiMcpEnabled: false
        }
      } as unknown as Project;

      const config = getGitHubConfig(project);

      expect(config).toBeNull();
    });

    it('should return null if .env file does not exist', () => {
      const project = createMockProject();

      mockExistsSync.mockReturnValue(false);

      const config = getGitHubConfig(project);

      expect(config).toBeNull();
    });

    it('should return null if GITHUB_TOKEN is missing', () => {
      const project = createMockProject();
      const envPath = path.join(project.path, project.autoBuildPath!, '.env');

      mockExistsSync.mockImplementation((p: string) => p === envPath);
      mockReadFileSync.mockImplementation((p: string) => {
        if (p === envPath) {
          return `GITHUB_REPO=owner/repo
IS_FORK=true`;
        }
        return '';
      });

      const config = getGitHubConfig(project);

      expect(config).toBeNull();
    });

    it('should return null if GITHUB_REPO is missing', () => {
      const project = createMockProject();
      const envPath = path.join(project.path, project.autoBuildPath!, '.env');

      mockExistsSync.mockImplementation((p: string) => p === envPath);
      mockReadFileSync.mockImplementation((p: string) => {
        if (p === envPath) {
          return `GITHUB_TOKEN=test-token
IS_FORK=true`;
        }
        return '';
      });

      const config = getGitHubConfig(project);

      expect(config).toBeNull();
    });

    it('should invalidate GITHUB_PARENT_REPO that does not contain /', () => {
      const project = createMockProject();
      const envPath = path.join(project.path, project.autoBuildPath!, '.env');

      mockExistsSync.mockImplementation((p: string) => p === envPath);
      mockReadFileSync.mockImplementation((p: string) => {
        if (p === envPath) {
          return `GITHUB_TOKEN=test-token
GITHUB_REPO=owner/repo
IS_FORK=true
GITHUB_PARENT_REPO=invalid-repo-format`;
        }
        return '';
      });

      const config = getGitHubConfig(project);

      expect(config).not.toBeNull();
      expect(config?.isFork).toBe(true);
      expect(config?.parentRepo).toBeUndefined();
    });
  });

  describe('normalizeRepoReference', () => {
    it('should return owner/repo unchanged', () => {
      expect(normalizeRepoReference('owner/repo')).toBe('owner/repo');
    });

    it('should normalize https://github.com/owner/repo URL', () => {
      expect(normalizeRepoReference('https://github.com/owner/repo')).toBe('owner/repo');
    });

    it('should normalize https://github.com/owner/repo.git URL', () => {
      expect(normalizeRepoReference('https://github.com/owner/repo.git')).toBe('owner/repo');
    });

    it('should normalize http://github.com/owner/repo URL', () => {
      expect(normalizeRepoReference('http://github.com/owner/repo')).toBe('owner/repo');
    });

    it('should normalize git@github.com:owner/repo.git URL', () => {
      expect(normalizeRepoReference('git@github.com:owner/repo.git')).toBe('owner/repo');
    });

    it('should remove trailing .git from owner/repo.git', () => {
      expect(normalizeRepoReference('owner/repo.git')).toBe('owner/repo');
    });

    it('should return empty string for empty input', () => {
      expect(normalizeRepoReference('')).toBe('');
    });

    it('should trim whitespace', () => {
      expect(normalizeRepoReference('  owner/repo  ')).toBe('owner/repo');
    });
  });
});

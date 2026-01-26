/**
 * GitHub Multi-Repository IPC handlers
 * Manages multiple repository configurations per project
 */

import { ipcMain } from 'electron';
import { IPC_CHANNELS } from '../../../shared/constants';
import type {
  IPCResult,
  GitHubMultiRepoConfig,
  GitHubRepoConfig,
  GitHubMultiRepoSyncStatus,
  GitHubRepoSyncStatus
} from '../../../shared/types';
import { projectStore } from '../../project-store';
import {
  readMultiRepoConfig,
  writeMultiRepoConfig,
  addRepository,
  removeRepository,
  updateRepository,
  setDefaultRepository,
  getGitHubRepos,
  migrateToMultiRepo,
  ensureMultiRepoConfig,
  getGitHubConfigForRepo,
  githubFetch,
  normalizeRepoReference
} from './utils';

/**
 * Get multi-repo configuration for a project
 */
export function registerGetMultiRepoConfig(): void {
  ipcMain.handle(
    IPC_CHANNELS.GITHUB_MULTI_REPO_GET_CONFIG,
    async (_, projectId: string): Promise<IPCResult<GitHubMultiRepoConfig>> => {
      const project = projectStore.getProject(projectId);
      if (!project) {
        return { success: false, error: 'Project not found' };
      }

      try {
        const config = ensureMultiRepoConfig(project);
        return { success: true, data: config };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to get config'
        };
      }
    }
  );
}

/**
 * Save multi-repo configuration for a project
 */
export function registerSaveMultiRepoConfig(): void {
  ipcMain.handle(
    IPC_CHANNELS.GITHUB_MULTI_REPO_SAVE_CONFIG,
    async (_, projectId: string, config: GitHubMultiRepoConfig): Promise<IPCResult<boolean>> => {
      const project = projectStore.getProject(projectId);
      if (!project) {
        return { success: false, error: 'Project not found' };
      }

      try {
        const success = writeMultiRepoConfig(project, config);
        if (!success) {
          return { success: false, error: 'Failed to write configuration' };
        }
        return { success: true, data: true };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to save config'
        };
      }
    }
  );
}

/**
 * Add a repository to the configuration
 */
export function registerAddRepository(): void {
  ipcMain.handle(
    IPC_CHANNELS.GITHUB_MULTI_REPO_ADD_REPO,
    async (_, projectId: string, repoConfig: GitHubRepoConfig): Promise<IPCResult<GitHubMultiRepoConfig>> => {
      const project = projectStore.getProject(projectId);
      if (!project) {
        return { success: false, error: 'Project not found' };
      }

      try {
        // Normalize repo reference
        const normalizedRepo = normalizeRepoReference(repoConfig.repo);
        if (!normalizedRepo) {
          return { success: false, error: 'Invalid repository format' };
        }

        const normalizedConfig = { ...repoConfig, repo: normalizedRepo };
        const success = addRepository(project, normalizedConfig);
        if (!success) {
          return { success: false, error: 'Failed to add repository' };
        }

        const config = readMultiRepoConfig(project);
        return { success: true, data: config! };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to add repository'
        };
      }
    }
  );
}

/**
 * Remove a repository from the configuration
 */
export function registerRemoveRepository(): void {
  ipcMain.handle(
    IPC_CHANNELS.GITHUB_MULTI_REPO_REMOVE_REPO,
    async (_, projectId: string, repo: string): Promise<IPCResult<GitHubMultiRepoConfig>> => {
      const project = projectStore.getProject(projectId);
      if (!project) {
        return { success: false, error: 'Project not found' };
      }

      try {
        const success = removeRepository(project, repo);
        if (!success) {
          return { success: false, error: 'Failed to remove repository' };
        }

        const config = readMultiRepoConfig(project);
        return { success: true, data: config! };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to remove repository'
        };
      }
    }
  );
}

/**
 * Update a repository in the configuration
 */
export function registerUpdateRepository(): void {
  ipcMain.handle(
    IPC_CHANNELS.GITHUB_MULTI_REPO_UPDATE_REPO,
    async (_, projectId: string, repoConfig: GitHubRepoConfig): Promise<IPCResult<GitHubMultiRepoConfig>> => {
      const project = projectStore.getProject(projectId);
      if (!project) {
        return { success: false, error: 'Project not found' };
      }

      try {
        const success = updateRepository(project, repoConfig);
        if (!success) {
          return { success: false, error: 'Failed to update repository' };
        }

        const config = readMultiRepoConfig(project);
        return { success: true, data: config! };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to update repository'
        };
      }
    }
  );
}

/**
 * Set the default repository
 */
export function registerSetDefaultRepository(): void {
  ipcMain.handle(
    IPC_CHANNELS.GITHUB_MULTI_REPO_SET_DEFAULT,
    async (_, projectId: string, repo: string): Promise<IPCResult<GitHubMultiRepoConfig>> => {
      const project = projectStore.getProject(projectId);
      if (!project) {
        return { success: false, error: 'Project not found' };
      }

      try {
        const success = setDefaultRepository(project, repo);
        if (!success) {
          return { success: false, error: 'Failed to set default repository' };
        }

        const config = readMultiRepoConfig(project);
        return { success: true, data: config! };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to set default'
        };
      }
    }
  );
}

/**
 * Check connection status for all configured repositories
 */
export function registerCheckAllConnections(): void {
  ipcMain.handle(
    IPC_CHANNELS.GITHUB_MULTI_REPO_CHECK_ALL,
    async (_, projectId: string): Promise<IPCResult<GitHubMultiRepoSyncStatus>> => {
      const project = projectStore.getProject(projectId);
      if (!project) {
        return { success: false, error: 'Project not found' };
      }

      try {
        const repos = getGitHubRepos(project);
        if (repos.length === 0) {
          return {
            success: true,
            data: {
              connected: false,
              repos: [],
              error: 'No repositories configured'
            }
          };
        }

        // Check each repository in parallel
        const statusPromises = repos.map(async (repoConfig): Promise<GitHubRepoSyncStatus> => {
          const config = getGitHubConfigForRepo(project, repoConfig.repo);
          if (!config) {
            return {
              repo: repoConfig.repo,
              connected: false,
              error: 'No token available'
            };
          }

          try {
            const normalizedRepo = normalizeRepoReference(repoConfig.repo);

            // Fetch repo info
            const repoData = await githubFetch(
              config.token,
              `/repos/${normalizedRepo}`
            ) as { full_name: string; description?: string; open_issues_count?: number };

            // Fetch open PRs count
            const prsData = await githubFetch(
              config.token,
              `/repos/${normalizedRepo}/pulls?state=open&per_page=1`
            ) as unknown[];

            return {
              repo: repoConfig.repo,
              connected: true,
              repoFullName: repoData.full_name,
              repoDescription: repoData.description,
              issueCount: repoData.open_issues_count || 0,
              prCount: Array.isArray(prsData) ? prsData.length : 0,
              lastSyncedAt: new Date().toISOString()
            };
          } catch (error) {
            return {
              repo: repoConfig.repo,
              connected: false,
              error: error instanceof Error ? error.message : 'Connection failed'
            };
          }
        });

        const repoStatuses = await Promise.all(statusPromises);

        // Aggregate status
        const connectedRepos = repoStatuses.filter(s => s.connected);
        const totalIssueCount = repoStatuses.reduce((sum, s) => sum + (s.issueCount || 0), 0);
        const totalPrCount = repoStatuses.reduce((sum, s) => sum + (s.prCount || 0), 0);

        return {
          success: true,
          data: {
            connected: connectedRepos.length > 0,
            repos: repoStatuses,
            totalIssueCount,
            totalPrCount,
            error: connectedRepos.length === 0 ? 'All connections failed' : undefined
          }
        };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to check connections'
        };
      }
    }
  );
}

/**
 * Migrate from legacy single-repo to multi-repo configuration
 */
export function registerMigrate(): void {
  ipcMain.handle(
    IPC_CHANNELS.GITHUB_MULTI_REPO_MIGRATE,
    async (_, projectId: string): Promise<IPCResult<{ migrated: boolean; config?: GitHubMultiRepoConfig }>> => {
      const project = projectStore.getProject(projectId);
      if (!project) {
        return { success: false, error: 'Project not found' };
      }

      try {
        const result = migrateToMultiRepo(project);
        if (result.error) {
          return { success: false, error: result.error };
        }

        const config = readMultiRepoConfig(project);
        return {
          success: true,
          data: {
            migrated: result.migrated,
            config: config || undefined
          }
        };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Migration failed'
        };
      }
    }
  );
}

/**
 * Register all multi-repo handlers
 */
export function registerMultiRepoHandlers(): void {
  registerGetMultiRepoConfig();
  registerSaveMultiRepoConfig();
  registerAddRepository();
  registerRemoveRepository();
  registerUpdateRepository();
  registerSetDefaultRepository();
  registerCheckAllConnections();
  registerMigrate();
}

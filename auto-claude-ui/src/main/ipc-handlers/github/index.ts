/**
 * GitHub integration IPC handlers
 *
 * Main entry point that registers all GitHub-related handlers.
 * Handlers are organized into modules by functionality:
 * - repository-handlers: Repository and connection management
 * - issue-handlers: Issue fetching and retrieval
 * - investigation-handlers: AI-powered issue investigation
 * - import-handlers: Bulk issue import
 * - release-handlers: GitHub release creation
 */

import type { BrowserWindow } from 'electron';
import { AgentManager } from '../../agent';
import { registerRepositoryHandlers } from './repository-handlers';
import { registerIssueHandlers } from './issue-handlers';
import { registerInvestigationHandlers } from './investigation-handlers';
import { registerImportHandlers } from './import-handlers';
import { registerReleaseHandlers } from './release-handlers';

/**
 * Register all GitHub-related IPC handlers
 */
export function registerGithubHandlers(
  agentManager: AgentManager,
  getMainWindow: () => BrowserWindow | null
): void {
  registerRepositoryHandlers();
  registerIssueHandlers();
  registerInvestigationHandlers(agentManager, getMainWindow);
  registerImportHandlers(agentManager);
  registerReleaseHandlers();
}

// Re-export utilities for potential external use
export { getGitHubConfig, githubFetch } from './utils';
export type { GitHubConfig } from './types';

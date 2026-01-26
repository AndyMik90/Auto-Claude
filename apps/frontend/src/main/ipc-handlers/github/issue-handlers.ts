/**
 * GitHub issue-related IPC handlers
 */

import { ipcMain } from 'electron';
import { IPC_CHANNELS } from '../../../shared/constants';
import type { IPCResult, GitHubIssue, PaginatedIssuesResult } from '../../../shared/types';
import { projectStore } from '../../project-store';
import { getGitHubConfig, getGitHubRepos, getGitHubConfigForRepo, githubFetch, normalizeRepoReference } from './utils';
import type { GitHubAPIIssue, GitHubAPIComment } from './types';
import { debugLog } from '../../../shared/utils/debug-logger';

// Pagination constants
const ISSUES_PER_PAGE = 50;           // Target number of issues per page (after filtering PRs)
const GITHUB_API_PER_PAGE = 100;      // GitHub API's max items per request
const MAX_PAGES_PAGINATED = 5;        // Max API pages to fetch in paginated mode
const MAX_PAGES_FETCH_ALL = 30;       // Max API pages to fetch in fetchAll mode

/**
 * Transform GitHub API issue to application format
 */
function transformIssue(issue: GitHubAPIIssue, repoFullName: string): GitHubIssue {
  return {
    id: issue.id,
    number: issue.number,
    title: issue.title,
    body: issue.body,
    state: issue.state,
    labels: issue.labels,
    assignees: issue.assignees.map(a => ({
      login: a.login,
      avatarUrl: a.avatar_url
    })),
    author: {
      login: issue.user.login,
      avatarUrl: issue.user.avatar_url
    },
    milestone: issue.milestone,
    createdAt: issue.created_at,
    updatedAt: issue.updated_at,
    closedAt: issue.closed_at,
    commentsCount: issue.comments,
    url: issue.url,
    htmlUrl: issue.html_url,
    repoFullName
  };
}

/**
 * Fetch issues from a single repository
 */
async function fetchIssuesFromSingleRepo(
  token: string,
  repoFullName: string,
  state: 'open' | 'closed' | 'all',
  maxPages: number
): Promise<GitHubIssue[]> {
  const allIssues: GitHubAPIIssue[] = [];
  let apiPage = 1;

  while (apiPage <= maxPages) {
    try {
      const pageIssues = await githubFetch(
        token,
        `/repos/${repoFullName}/issues?state=${state}&per_page=${GITHUB_API_PER_PAGE}&sort=updated&page=${apiPage}`
      );

      if (!Array.isArray(pageIssues) || pageIssues.length === 0) {
        break;
      }

      // Filter out PRs
      const issuesOnly = pageIssues.filter((issue: GitHubAPIIssue) => !issue.pull_request);
      allIssues.push(...issuesOnly);

      if (pageIssues.length < GITHUB_API_PER_PAGE) {
        break;
      }

      apiPage++;
    } catch (error) {
      debugLog('[GitHub Issues] Error fetching from repo:', repoFullName, error);
      break;
    }
  }

  return allIssues.map(issue => transformIssue(issue, repoFullName));
}

/**
 * Get list of issues from repository with pagination support (multi-repo)
 *
 * When page > 0: Returns paginated results (for infinite scroll)
 * When page = 0 or fetchAll = true: Returns ALL issues (for search functionality)
 *
 * Note: GitHub's /issues endpoint returns both issues and PRs mixed together,
 * so we need to over-fetch and filter to get enough actual issues per page.
 */
export function registerGetIssues(): void {
  ipcMain.handle(
    IPC_CHANNELS.GITHUB_GET_ISSUES,
    async (
      _,
      projectId: string,
      state: 'open' | 'closed' | 'all' = 'open',
      page: number = 1,
      fetchAll: boolean = false
    ): Promise<IPCResult<PaginatedIssuesResult>> => {
      debugLog('[GitHub Issues] getIssues handler called', { projectId, state, page, fetchAll });

      const project = projectStore.getProject(projectId);
      if (!project) {
        debugLog('[GitHub Issues] Project not found:', projectId);
        return { success: false, error: 'Project not found' };
      }

      // Get all configured repositories
      const repos = getGitHubRepos(project);
      if (repos.length === 0) {
        debugLog('[GitHub Issues] No GitHub repos configured for project');
        return { success: false, error: 'No GitHub token or repository configured' };
      }

      // Filter to only enabled repos with issues sync enabled
      const enabledRepos = repos.filter(r => r.enabled !== false && r.issuesSyncEnabled !== false);
      if (enabledRepos.length === 0) {
        debugLog('[GitHub Issues] No enabled repos with issues sync');
        return { success: false, error: 'No enabled repositories with issues sync' };
      }

      debugLog('[GitHub Issues] Fetching issues from repos:', enabledRepos.map(r => r.repo));

      try {
        const maxPagesPerRepo = fetchAll ? MAX_PAGES_FETCH_ALL : MAX_PAGES_PAGINATED;

        // Fetch issues from all enabled repositories in parallel
        const issuePromises = enabledRepos.map(async (repoConfig) => {
          const config = getGitHubConfigForRepo(project, repoConfig.repo);
          if (!config) {
            debugLog('[GitHub Issues] No GitHub config for repo:', repoConfig.repo);
            return [];
          }

          const normalizedRepo = normalizeRepoReference(repoConfig.repo);
          if (!normalizedRepo) {
            debugLog('[GitHub Issues] Invalid repo format:', repoConfig.repo);
            return [];
          }

          return fetchIssuesFromSingleRepo(config.token, normalizedRepo, state, maxPagesPerRepo);
        });

        const issueArrays = await Promise.all(issuePromises);
        const allIssues = issueArrays.flat();

        // Sort by updatedAt (most recent first)
        allIssues.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

        debugLog('[GitHub Issues] Total issues from all repos:', allIssues.length);

        if (fetchAll) {
          return { success: true, data: { issues: allIssues, hasMore: false } };
        }

        // Paginated results
        const targetStartIndex = (page - 1) * ISSUES_PER_PAGE;
        const targetEndIndex = page * ISSUES_PER_PAGE;
        const pageIssues = allIssues.slice(targetStartIndex, targetEndIndex);
        const hasMore = allIssues.length > targetEndIndex;

        debugLog('[GitHub Issues] Returning page', page, ':', pageIssues.length, 'issues, hasMore:', hasMore);
        return { success: true, data: { issues: pageIssues, hasMore } };
      } catch (error) {
        debugLog('[GitHub Issues] Error fetching issues:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to fetch issues'
        };
      }
    }
  );
}

/**
 * Get a single issue by number
 */
export function registerGetIssue(): void {
  ipcMain.handle(
    IPC_CHANNELS.GITHUB_GET_ISSUE,
    async (_, projectId: string, issueNumber: number): Promise<IPCResult<GitHubIssue>> => {
      const project = projectStore.getProject(projectId);
      if (!project) {
        return { success: false, error: 'Project not found' };
      }

      const config = getGitHubConfig(project);
      if (!config) {
        return { success: false, error: 'No GitHub token or repository configured' };
      }

      try {
        const normalizedRepo = normalizeRepoReference(config.repo);
        if (!normalizedRepo) {
          return {
            success: false,
            error: 'Invalid repository format. Use owner/repo or GitHub URL.'
          };
        }

        const issue = await githubFetch(
          config.token,
          `/repos/${normalizedRepo}/issues/${issueNumber}`
        ) as GitHubAPIIssue;

        const result = transformIssue(issue, normalizedRepo);

        return { success: true, data: result };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to fetch issue'
        };
      }
    }
  );
}

/**
 * Get comments for a specific issue
 */
export function registerGetIssueComments(): void {
  ipcMain.handle(
    IPC_CHANNELS.GITHUB_GET_ISSUE_COMMENTS,
    async (_, projectId: string, issueNumber: number): Promise<IPCResult<GitHubAPIComment[]>> => {
      const project = projectStore.getProject(projectId);
      if (!project) {
        return { success: false, error: 'Project not found' };
      }

      const config = getGitHubConfig(project);
      if (!config) {
        return { success: false, error: 'No GitHub token or repository configured' };
      }

      try {
        const normalizedRepo = normalizeRepoReference(config.repo);
        if (!normalizedRepo) {
          return {
            success: false,
            error: 'Invalid repository format. Use owner/repo or GitHub URL.'
          };
        }

        const comments = await githubFetch(
          config.token,
          `/repos/${normalizedRepo}/issues/${issueNumber}/comments`
        ) as GitHubAPIComment[];

        return { success: true, data: comments };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to fetch issue comments'
        };
      }
    }
  );
}

/**
 * Register all issue-related handlers
 */
export function registerIssueHandlers(): void {
  registerGetIssues();
  registerGetIssue();
  registerGetIssueComments();
}

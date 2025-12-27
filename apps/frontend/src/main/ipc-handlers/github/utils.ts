/**
 * GitHub utility functions
 */

import { existsSync, readFileSync } from 'fs';
import { execFileSync } from 'child_process';
import path from 'path';
import type { Project } from '../../../shared/types';
import { parseEnvFile } from '../utils';
import type { GitHubConfig } from './types';
import { getAugmentedEnv } from '../../env-utils';
import { getToolPath } from '../../cli-tool-manager';

/**
 * Get GitHub token from gh CLI if available
 * Uses augmented PATH to find gh CLI in common locations (e.g., Homebrew on macOS)
 */
function getTokenFromGhCli(): string | null {
  try {
    const token = execFileSync(getToolPath('gh'), ['auth', 'token'], {
      encoding: 'utf-8',
      stdio: 'pipe',
      env: getAugmentedEnv()
    }).trim();
    return token || null;
  } catch {
    return null;
  }
}

/**
 * Get GitHub configuration from project environment file
 * Falls back to gh CLI token if GITHUB_TOKEN not in .env
 */
export function getGitHubConfig(project: Project): GitHubConfig | null {
  if (!project.autoBuildPath) return null;
  const envPath = path.join(project.path, project.autoBuildPath, '.env');
  if (!existsSync(envPath)) return null;

  try {
    const content = readFileSync(envPath, 'utf-8');
    const vars = parseEnvFile(content);
    let token: string | undefined = vars['GITHUB_TOKEN'];
    const repo = vars['GITHUB_REPO'];

    // If no token in .env, try to get it from gh CLI
    if (!token) {
      const ghToken = getTokenFromGhCli();
      if (ghToken) {
        token = ghToken;
      }
    }

    if (!token || !repo) return null;

    // Read optional fork-related configuration
    const isForkValue = vars['IS_FORK'];
    const isFork = isForkValue?.toLowerCase() === 'true';
    const parentRepo = vars['GITHUB_PARENT_REPO'];

    return {
      token,
      repo,
      ...(isFork && { isFork }),
      ...(parentRepo && { parentRepo })
    };
  } catch {
    return null;
  }
}

/**
 * Normalize a GitHub repository reference to owner/repo format
 * Handles:
 * - owner/repo (already normalized)
 * - https://github.com/owner/repo
 * - https://github.com/owner/repo.git
 * - git@github.com:owner/repo.git
 */
export function normalizeRepoReference(repo: string): string {
  if (!repo) return '';

  // Remove trailing .git if present
  let normalized = repo.replace(/\.git$/, '');

  // Handle full GitHub URLs
  if (normalized.startsWith('https://github.com/')) {
    normalized = normalized.replace('https://github.com/', '');
  } else if (normalized.startsWith('http://github.com/')) {
    normalized = normalized.replace('http://github.com/', '');
  } else if (normalized.startsWith('git@github.com:')) {
    normalized = normalized.replace('git@github.com:', '');
  }

  return normalized.trim();
}

/**
 * Get the target repository for API calls
 *
 * For fork repositories, returns the parent repository when useParentForIssues is true
 * (used for fetching issues and PRs which belong to the upstream repo).
 * Otherwise, returns the fork repository (used for code operations).
 *
 * @param config - The GitHub configuration containing repo and optional fork info
 * @param useParentForIssues - Whether to use the parent repo (true for issues/PRs, false for code ops)
 * @returns The repository reference in owner/repo format
 */
export function getTargetRepo(config: GitHubConfig, useParentForIssues: boolean): string {
  // Use parent repo only when:
  // 1. We want to use parent for issues/PRs (useParentForIssues = true)
  // 2. The repo is marked as a fork (config.isFork = true)
  // 3. A parent repository is configured (config.parentRepo exists)
  if (useParentForIssues && config.isFork && config.parentRepo) {
    return normalizeRepoReference(config.parentRepo);
  }

  // Default to the fork/current repository
  return normalizeRepoReference(config.repo);
}

/**
 * Make a request to the GitHub API
 */
export async function githubFetch(
  token: string,
  endpoint: string,
  options: RequestInit = {}
): Promise<unknown> {
  const url = endpoint.startsWith('http')
    ? endpoint
    : `https://api.github.com${endpoint}`;

  const response = await fetch(url, {
    ...options,
    headers: {
      'Accept': 'application/vnd.github+json',
      'Authorization': `Bearer ${token}`,
      'User-Agent': 'Auto-Claude-UI',
      ...options.headers
    }
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`GitHub API error: ${response.status} ${response.statusText} - ${errorBody}`);
  }

  return response.json();
}

/**
 * Result from githubFetchWithFallback
 */
export interface FallbackFetchResult<T = unknown> {
  /** The data from the API call */
  data: T;
  /** The repository that was actually used for the API call */
  usedRepo: string;
  /** Whether a fallback occurred (parent repo was inaccessible) */
  usedFallback: boolean;
}

/**
 * Check if an error indicates the repository is inaccessible (403 Forbidden or 404 Not Found)
 */
function isRepoInaccessibleError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const message = error.message;
  // Check for 403 (Forbidden - no permission) or 404 (Not Found - deleted or private)
  return message.includes('403') || message.includes('404');
}

/**
 * Make a GitHub API request with automatic fallback to fork repo when parent is inaccessible
 *
 * When configured to use a parent repository (for issues/PRs in a fork), this function:
 * 1. First attempts to fetch from the parent repository
 * 2. If the parent is inaccessible (403 Forbidden or 404 Not Found), falls back to the fork
 * 3. Returns the result along with information about which repo was used
 *
 * This handles edge cases like:
 * - Deleted parent repository
 * - Private parent repository (user lacks access)
 * - Renamed parent repository
 *
 * @param config - The GitHub configuration containing token, repo, and optional fork info
 * @param endpointTemplate - The endpoint template with {repo} placeholder (e.g., '/repos/{repo}/issues')
 * @param useParentForIssues - Whether to try the parent repo first (true for issues/PRs)
 * @param options - Optional fetch options (method, body, headers)
 * @returns Promise with the data, used repo, and fallback indicator
 */
export async function githubFetchWithFallback<T = unknown>(
  config: GitHubConfig,
  endpointTemplate: string,
  useParentForIssues: boolean,
  options: RequestInit = {}
): Promise<FallbackFetchResult<T>> {
  const forkRepo = normalizeRepoReference(config.repo);
  const targetRepo = getTargetRepo(config, useParentForIssues);
  const isUsingParent = targetRepo !== forkRepo;

  // Replace {repo} placeholder in endpoint template
  const endpoint = endpointTemplate.replace('{repo}', targetRepo);

  try {
    const data = await githubFetch(config.token, endpoint, options) as T;
    return {
      data,
      usedRepo: targetRepo,
      usedFallback: false
    };
  } catch (error) {
    // If we were using the parent repo and it's inaccessible, fall back to fork
    if (isUsingParent && isRepoInaccessibleError(error)) {
      // Attempt fallback to fork repository
      const fallbackEndpoint = endpointTemplate.replace('{repo}', forkRepo);
      const data = await githubFetch(config.token, fallbackEndpoint, options) as T;
      return {
        data,
        usedRepo: forkRepo,
        usedFallback: true
      };
    }

    // Re-throw if not a fallback-eligible error or already using fork
    throw error;
  }
}
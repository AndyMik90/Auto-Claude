/**
 * GitHub utility functions
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { execFileSync, execFile } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import type { Project, GitHubMultiRepoConfig, GitHubRepoConfig } from '../../../shared/types';
import { parseEnvFile } from '../utils';
import type { GitHubConfig } from './types';
import { getAugmentedEnv } from '../../env-utils';
import { getToolPath } from '../../cli-tool-manager';

const execFileAsync = promisify(execFile);

/** Current schema version for github.json */
const GITHUB_CONFIG_VERSION = 1;

/** Filename for multi-repo configuration */
const GITHUB_CONFIG_FILENAME = 'github.json';

/**
 * Get GitHub token from gh CLI if available (async to avoid blocking main thread)
 * Uses augmented PATH to find gh CLI in common locations (e.g., Homebrew on macOS)
 */
async function getTokenFromGhCliAsync(): Promise<string | null> {
  try {
    const { stdout } = await execFileAsync(getToolPath('gh'), ['auth', 'token'], {
      encoding: 'utf-8',
      env: getAugmentedEnv()
    });
    const token = stdout.trim();
    return token || null;
  } catch {
    return null;
  }
}

/**
 * Get GitHub token from gh CLI if available (sync version for getGitHubConfig)
 * Uses augmented PATH to find gh CLI in common locations (e.g., Homebrew on macOS)
 */
function getTokenFromGhCliSync(): string | null {
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
 * Get a fresh GitHub token for subprocess use (async to avoid blocking main thread)
 * Always fetches fresh from gh CLI - no caching to ensure account changes are reflected
 * @returns The current GitHub token or null if not authenticated
 */
export async function getGitHubTokenForSubprocess(): Promise<string | null> {
  return getTokenFromGhCliAsync();
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

    // If no token in .env, try to get it from gh CLI (sync version for sync function)
    if (!token) {
      const ghToken = getTokenFromGhCliSync();
      if (ghToken) {
        token = ghToken;
      }
    }

    if (!token || !repo) return null;
    return { token, repo };
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

// ============================================
// Multi-Repository Configuration
// ============================================

/**
 * Get the path to the github.json configuration file
 */
export function getGitHubConfigPath(project: Project): string | null {
  if (!project.autoBuildPath) return null;
  return path.join(project.path, project.autoBuildPath, GITHUB_CONFIG_FILENAME);
}

/**
 * Read the multi-repository configuration from github.json
 * Returns null if the file doesn't exist or is invalid
 */
export function readMultiRepoConfig(project: Project): GitHubMultiRepoConfig | null {
  const configPath = getGitHubConfigPath(project);
  if (!configPath || !existsSync(configPath)) return null;

  try {
    const content = readFileSync(configPath, 'utf-8');
    const config = JSON.parse(content) as GitHubMultiRepoConfig;

    // Validate required fields
    if (!Array.isArray(config.repos)) {
      return null;
    }

    return config;
  } catch {
    return null;
  }
}

/**
 * Write the multi-repository configuration to github.json
 */
export function writeMultiRepoConfig(project: Project, config: GitHubMultiRepoConfig): boolean {
  const configPath = getGitHubConfigPath(project);
  if (!configPath) return false;

  try {
    // Ensure the directory exists
    const dir = path.dirname(configPath);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }

    // Write with pretty formatting
    writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf-8');
    return true;
  } catch (error) {
    console.error('Failed to write github.json:', error);
    return false;
  }
}

/**
 * Get all configured repositories for a project
 * Supports both legacy single-repo (.env) and multi-repo (github.json) configurations
 */
export function getGitHubRepos(project: Project): GitHubRepoConfig[] {
  // First, try to read multi-repo config
  const multiConfig = readMultiRepoConfig(project);
  if (multiConfig && multiConfig.repos.length > 0) {
    return multiConfig.repos;
  }

  // Fall back to legacy single-repo from .env
  const legacyConfig = getGitHubConfig(project);
  if (legacyConfig) {
    return [{
      repo: legacyConfig.repo,
      enabled: true,
      issuesSyncEnabled: true,
      prReviewEnabled: true,
      autoFixEnabled: true
    }];
  }

  return [];
}

/**
 * Get the default repository for a project
 * Returns the first enabled repository or the explicitly set default
 */
export function getDefaultRepo(project: Project): string | null {
  const multiConfig = readMultiRepoConfig(project);

  if (multiConfig) {
    // Use explicit default if set and exists in repos
    if (multiConfig.defaultRepo) {
      const exists = multiConfig.repos.some(r => r.repo === multiConfig.defaultRepo && r.enabled);
      if (exists) return multiConfig.defaultRepo;
    }

    // Otherwise, use first enabled repo
    const firstEnabled = multiConfig.repos.find(r => r.enabled);
    if (firstEnabled) return firstEnabled.repo;
  }

  // Fall back to legacy config
  const legacyConfig = getGitHubConfig(project);
  return legacyConfig?.repo || null;
}

/**
 * Get GitHub config for a specific repository
 * Returns token + repo config, falling back to gh CLI token if needed
 */
export function getGitHubConfigForRepo(project: Project, repo: string): GitHubConfig | null {
  if (!project.autoBuildPath) return null;

  // Get token from .env or gh CLI
  const envPath = path.join(project.path, project.autoBuildPath, '.env');
  let token: string | null = null;

  if (existsSync(envPath)) {
    try {
      const content = readFileSync(envPath, 'utf-8');
      const vars = parseEnvFile(content);
      token = vars['GITHUB_TOKEN'] || null;
    } catch {
      // Ignore parse errors
    }
  }

  // Fall back to gh CLI token
  if (!token) {
    token = getTokenFromGhCli();
  }

  if (!token) return null;

  return { token, repo };
}

/**
 * Add a repository to the multi-repo configuration
 */
export function addRepository(project: Project, repoConfig: GitHubRepoConfig): boolean {
  let config = readMultiRepoConfig(project);

  if (!config) {
    // Create new config, migrating from legacy if exists
    const legacyConfig = getGitHubConfig(project);
    config = {
      repos: [],
      version: GITHUB_CONFIG_VERSION
    };

    // Migrate legacy repo if exists
    if (legacyConfig) {
      config.repos.push({
        repo: legacyConfig.repo,
        enabled: true,
        issuesSyncEnabled: true,
        prReviewEnabled: true,
        autoFixEnabled: true
      });
      config.defaultRepo = legacyConfig.repo;
    }
  }

  // Check if repo already exists
  const existingIndex = config.repos.findIndex(r => r.repo === repoConfig.repo);
  if (existingIndex >= 0) {
    // Update existing
    config.repos[existingIndex] = repoConfig;
  } else {
    // Add new
    config.repos.push(repoConfig);
  }

  // Set as default if first repo
  if (config.repos.length === 1) {
    config.defaultRepo = repoConfig.repo;
  }

  return writeMultiRepoConfig(project, config);
}

/**
 * Remove a repository from the multi-repo configuration
 */
export function removeRepository(project: Project, repo: string): boolean {
  const config = readMultiRepoConfig(project);
  if (!config) return false;

  const index = config.repos.findIndex(r => r.repo === repo);
  if (index < 0) return false;

  config.repos.splice(index, 1);

  // Update default if we removed it
  if (config.defaultRepo === repo) {
    config.defaultRepo = config.repos.length > 0 ? config.repos[0].repo : undefined;
  }

  return writeMultiRepoConfig(project, config);
}

/**
 * Update a repository in the multi-repo configuration
 */
export function updateRepository(project: Project, repoConfig: GitHubRepoConfig): boolean {
  const config = readMultiRepoConfig(project);
  if (!config) return false;

  const index = config.repos.findIndex(r => r.repo === repoConfig.repo);
  if (index < 0) return false;

  config.repos[index] = repoConfig;
  return writeMultiRepoConfig(project, config);
}

/**
 * Set the default repository
 */
export function setDefaultRepository(project: Project, repo: string): boolean {
  const config = readMultiRepoConfig(project);
  if (!config) return false;

  // Verify repo exists
  const exists = config.repos.some(r => r.repo === repo);
  if (!exists) return false;

  config.defaultRepo = repo;
  return writeMultiRepoConfig(project, config);
}

// ============================================
// Migration Functions
// ============================================

/**
 * Check if migration from legacy single-repo to multi-repo is needed
 */
export function needsMigration(project: Project): boolean {
  // If github.json already exists, no migration needed
  const configPath = getGitHubConfigPath(project);
  if (configPath && existsSync(configPath)) {
    return false;
  }

  // If legacy config exists, migration is needed
  const legacyConfig = getGitHubConfig(project);
  return legacyConfig !== null;
}

/**
 * Migrate from legacy single-repo (.env GITHUB_REPO) to multi-repo (github.json)
 * Returns true if migration was successful or not needed
 */
export function migrateToMultiRepo(project: Project): { migrated: boolean; error?: string } {
  // Check if already migrated
  const configPath = getGitHubConfigPath(project);
  if (configPath && existsSync(configPath)) {
    return { migrated: false }; // Already has github.json
  }

  // Get legacy config
  const legacyConfig = getGitHubConfig(project);
  if (!legacyConfig) {
    return { migrated: false }; // No legacy config to migrate
  }

  // Create new multi-repo config
  const multiConfig: GitHubMultiRepoConfig = {
    repos: [{
      repo: legacyConfig.repo,
      enabled: true,
      issuesSyncEnabled: true,
      prReviewEnabled: true,
      autoFixEnabled: true
    }],
    defaultRepo: legacyConfig.repo,
    version: GITHUB_CONFIG_VERSION,
    lastSyncedAt: new Date().toISOString()
  };

  // Write the new config
  const success = writeMultiRepoConfig(project, multiConfig);
  if (!success) {
    return { migrated: false, error: 'Failed to write github.json' };
  }

  console.log(`Migrated GitHub config for project ${project.name}: ${legacyConfig.repo}`);
  return { migrated: true };
}

/**
 * Ensure the project has a multi-repo config
 * Migrates from legacy if needed, or creates empty config
 */
export function ensureMultiRepoConfig(project: Project): GitHubMultiRepoConfig {
  // Try to read existing config
  let config = readMultiRepoConfig(project);
  if (config) {
    return config;
  }

  // Try to migrate from legacy
  const legacyConfig = getGitHubConfig(project);
  if (legacyConfig) {
    config = {
      repos: [{
        repo: legacyConfig.repo,
        enabled: true,
        issuesSyncEnabled: true,
        prReviewEnabled: true,
        autoFixEnabled: true
      }],
      defaultRepo: legacyConfig.repo,
      version: GITHUB_CONFIG_VERSION
    };
    writeMultiRepoConfig(project, config);
    return config;
  }

  // Create empty config
  config = {
    repos: [],
    version: GITHUB_CONFIG_VERSION
  };

  return config;
}

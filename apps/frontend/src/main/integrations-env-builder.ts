/**
 * Integrations Environment Variable Builder
 *
 * Converts app-wide integration settings (JIRA, GitLab, Obsidian) from settings.json
 * into environment variables that can be injected into Python agent processes.
 *
 * This bridges the gap between frontend settings UI and backend agent configuration.
 */

import type { AppSettings } from '../shared/types/settings';

/**
 * Build environment variables for JIRA integration from app settings.
 *
 * @param settings - App-wide settings from settings.json
 * @returns Record of JIRA-related environment variables
 */
export function buildJiraEnvVars(settings: AppSettings): Record<string, string> {
  const env: Record<string, string> = {};

  // Check if JIRA is configured
  const host = settings.globalJiraHost;
  const email = settings.globalJiraEmail;
  const token = settings.globalJiraToken;

  if (host && email && token) {
    env.JIRA_MCP_ENABLED = 'true';
    env.JIRA_HOST = host;
    env.JIRA_URL = host; // Alias
    env.JIRA_EMAIL = email;
    env.JIRA_API_TOKEN = token;
    env.JIRA_TOKEN = token; // Alias

    // Optional: default project
    if (settings.globalJiraDefaultProject) {
      env.JIRA_DEFAULT_PROJECT = settings.globalJiraDefaultProject;
    }
  }

  return env;
}

/**
 * Build environment variables for GitLab integration from app settings.
 *
 * @param settings - App-wide settings from settings.json
 * @returns Record of GitLab-related environment variables
 */
export function buildGitLabEnvVars(settings: AppSettings): Record<string, string> {
  const env: Record<string, string> = {};

  // Check if GitLab is configured
  const host = settings.globalGitlabInstanceUrl;
  const token = settings.globalGitlabToken;

  if (host && token) {
    env.GITLAB_MCP_ENABLED = 'true';
    env.GITLAB_HOST = host;
    env.GITLAB_URL = host; // Alias
    env.GITLAB_TOKEN = token;
    env.GITLAB_PRIVATE_TOKEN = token; // Alias
  }

  return env;
}

/**
 * Build environment variables for Obsidian/Vault integration from app settings.
 *
 * @param settings - App-wide settings from settings.json
 * @returns Record of Obsidian/Vault-related environment variables
 */
export function buildObsidianEnvVars(settings: AppSettings): Record<string, string> {
  const env: Record<string, string> = {};

  // Check if Vault is configured and enabled
  const vaultPath = settings.globalVaultPath;
  const vaultEnabled = settings.vaultEnabled;

  if (vaultPath && vaultEnabled) {
    env.OBSIDIAN_MCP_ENABLED = 'true';
    env.VAULT_PATH = vaultPath;
    env.OBSIDIAN_VAULT_PATH = vaultPath; // Alias

    // Sync settings
    if (settings.vaultAutoLoad) {
      env.VAULT_AUTO_LOAD = 'true';
    }
    if (settings.vaultSyncLearnings) {
      env.VAULT_SYNC_LEARNINGS = 'true';
    }
    if (settings.vaultWriteEnabled) {
      env.VAULT_WRITE_ENABLED = 'true';
    }
  }

  return env;
}

/**
 * Build all integration environment variables from app settings.
 *
 * Combines JIRA, GitLab, and Obsidian settings into a single env object.
 *
 * @param settings - App-wide settings from settings.json
 * @returns Record of all integration-related environment variables
 */
export function buildIntegrationsEnvVars(settings: AppSettings): Record<string, string> {
  return {
    ...buildJiraEnvVars(settings),
    ...buildGitLabEnvVars(settings),
    ...buildObsidianEnvVars(settings),
  };
}

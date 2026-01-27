/**
 * Integrations Environment Variable Builder
 *
 * Converts integration settings from project-level config (with global fallback)
 * into environment variables that can be injected into Python agent processes.
 *
 * This bridges the gap between frontend settings UI and backend agent configuration.
 *
 * PRIORITY: Project settings take precedence over global settings.
 */

import type { AppSettings } from '../shared/types/settings';
import type { ProjectEnvConfig } from '../shared/types/project';

/**
 * Build environment variables for JIRA integration.
 * Reads from project settings first, falls back to global settings.
 *
 * @param projectEnv - Project-level environment config (or null)
 * @param globalSettings - App-wide settings from settings.json
 * @returns Record of JIRA-related environment variables
 */
export function buildJiraEnvVars(
  projectEnv: ProjectEnvConfig | null,
  globalSettings: AppSettings
): Record<string, string> {
  const env: Record<string, string> = {};

  // Project settings take precedence, fall back to global
  const host = projectEnv?.jiraHost || globalSettings.globalJiraHost;
  const email = projectEnv?.jiraEmail || globalSettings.globalJiraEmail;
  const token = projectEnv?.jiraToken || globalSettings.globalJiraToken;
  const projectKey = projectEnv?.jiraProjectKey || globalSettings.globalJiraDefaultProject;

  // Check if JIRA is explicitly enabled at project level, or implicitly via config
  const jiraEnabled = projectEnv?.jiraEnabled ?? (host && email && token);

  if (jiraEnabled && host && email && token) {
    env.JIRA_MCP_ENABLED = 'true';
    env.JIRA_HOST = host;
    env.JIRA_URL = host; // Alias
    env.JIRA_EMAIL = email;
    env.JIRA_API_TOKEN = token;
    env.JIRA_TOKEN = token; // Alias

    // Optional: default project
    if (projectKey) {
      env.JIRA_DEFAULT_PROJECT = projectKey;
      env.JIRA_PROJECT_KEY = projectKey; // Alias
    }
  }

  return env;
}

/**
 * Legacy overload for backward compatibility.
 * @deprecated Use the two-argument version with projectEnv and globalSettings.
 */
export function buildJiraEnvVarsFromGlobal(settings: AppSettings): Record<string, string> {
  return buildJiraEnvVars(null, settings);
}

/**
 * Build environment variables for GitLab integration.
 * Reads from project settings first, falls back to global settings.
 *
 * @param projectEnv - Project-level environment config (or null)
 * @param globalSettings - App-wide settings from settings.json
 * @returns Record of GitLab-related environment variables
 */
export function buildGitLabEnvVars(
  projectEnv: ProjectEnvConfig | null,
  globalSettings: AppSettings
): Record<string, string> {
  const env: Record<string, string> = {};

  // Project settings take precedence, fall back to global
  const host = projectEnv?.gitlabInstanceUrl || globalSettings.globalGitlabInstanceUrl;
  const token = projectEnv?.gitlabToken || globalSettings.globalGitlabToken;
  const project = projectEnv?.gitlabProject;

  // Check if GitLab is explicitly enabled at project level
  const gitlabEnabled = projectEnv?.gitlabEnabled ?? (host && token);

  if (gitlabEnabled && host && token) {
    env.GITLAB_MCP_ENABLED = 'true';
    env.GITLAB_HOST = host;
    env.GITLAB_URL = host; // Alias
    env.GITLAB_TOKEN = token;
    env.GITLAB_PRIVATE_TOKEN = token; // Alias

    if (project) {
      env.GITLAB_PROJECT = project;
    }
  }

  return env;
}

/**
 * Legacy overload for backward compatibility.
 * @deprecated Use the two-argument version with projectEnv and globalSettings.
 */
export function buildGitLabEnvVarsFromGlobal(settings: AppSettings): Record<string, string> {
  return buildGitLabEnvVars(null, settings);
}

/**
 * Build environment variables for Obsidian/Vault integration from app settings.
 * Vault is always configured globally (no project-level override).
 *
 * @param globalSettings - App-wide settings from settings.json
 * @returns Record of Obsidian/Vault-related environment variables
 */
export function buildObsidianEnvVars(globalSettings: AppSettings): Record<string, string> {
  const env: Record<string, string> = {};

  // Check if Vault is configured and enabled
  const vaultPath = globalSettings.globalVaultPath;
  const vaultEnabled = globalSettings.vaultEnabled;

  if (vaultPath && vaultEnabled) {
    env.OBSIDIAN_MCP_ENABLED = 'true';
    env.VAULT_PATH = vaultPath;
    env.OBSIDIAN_VAULT_PATH = vaultPath; // Alias

    // Sync settings
    if (globalSettings.vaultAutoLoad) {
      env.VAULT_AUTO_LOAD = 'true';
    }
    if (globalSettings.vaultSyncLearnings) {
      env.VAULT_SYNC_LEARNINGS = 'true';
    }
    if (globalSettings.vaultWriteEnabled) {
      env.VAULT_WRITE_ENABLED = 'true';
    }
  }

  return env;
}

/**
 * Build all integration environment variables.
 * Uses project-level config with global fallback for JIRA and GitLab.
 *
 * @param projectEnv - Project-level environment config (or null)
 * @param globalSettings - App-wide settings from settings.json
 * @returns Record of all integration-related environment variables
 */
export function buildIntegrationsEnvVars(
  projectEnv: ProjectEnvConfig | null,
  globalSettings: AppSettings
): Record<string, string> {
  return {
    ...buildJiraEnvVars(projectEnv, globalSettings),
    ...buildGitLabEnvVars(projectEnv, globalSettings),
    ...buildObsidianEnvVars(globalSettings),
  };
}

/**
 * Legacy overload for backward compatibility.
 * @deprecated Use the two-argument version with projectEnv and globalSettings.
 */
export function buildIntegrationsEnvVarsFromGlobal(settings: AppSettings): Record<string, string> {
  return buildIntegrationsEnvVars(null, settings);
}

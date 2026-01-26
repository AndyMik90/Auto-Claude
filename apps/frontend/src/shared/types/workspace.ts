/**
 * Workspace-related types for multi-repository support.
 *
 * A Workspace is a container that can hold multiple Git repositories,
 * allowing Auto-Claude to work with monorepos or multi-repo setups
 * without requiring the project root to be a Git repository itself.
 */

import type { NotificationSettings } from './project';

/**
 * Represents a workspace containing multiple repositories.
 * The workspace itself does not need to be a Git repository.
 */
export interface Workspace {
  /** Unique identifier for the workspace */
  id: string;
  /** Display name of the workspace */
  name: string;
  /** Absolute path to the workspace root directory */
  path: string;
  /** List of repositories within this workspace */
  repos: WorkspaceRepo[];
  /** Workspace-level settings (shared across all repos) */
  settings: WorkspaceSettings;
  /** When the workspace was created */
  createdAt: Date;
  /** When the workspace was last modified */
  updatedAt: Date;
}

/**
 * Represents a Git repository within a workspace.
 */
export interface WorkspaceRepo {
  /** Unique identifier for this repository within the workspace */
  id: string;
  /** Display name of the repository */
  name: string;
  /** Path relative to workspace root (e.g., "frontend", "apps/backend") */
  relativePath: string;
  /** Whether this is the default repo for new tasks */
  isDefault: boolean;
  /** Main branch name (e.g., "main", "master", "develop") */
  mainBranch?: string;
  /** Remote URL if configured */
  remoteUrl?: string;
  /** Whether this repo is a symlink to an external location */
  isSymlink?: boolean;
  /** Original absolute path if this is a symlink */
  originalPath?: string;
}

/**
 * Workspace-level settings shared across all repositories.
 * Individual repos may override some settings.
 */
export interface WorkspaceSettings {
  /** Default model for agents */
  model: string;
  /** Memory backend type */
  memoryBackend: 'graphiti' | 'file';
  /** Notification preferences */
  notifications: NotificationSettings;
  /** Enable Graphiti MCP server */
  graphitiMcpEnabled: boolean;
  /** Graphiti MCP server URL */
  graphitiMcpUrl?: string;
  /** Include CLAUDE.md in agent prompts */
  useClaudeMd?: boolean;
  /** Maximum parallel tasks */
  maxParallelTasks?: number;
}

/**
 * Schema for workspace.json file stored in .auto-claude/workspace.json
 */
export interface WorkspaceConfig {
  /** Schema version for future migrations */
  version: number;
  /** Workspace display name */
  name: string;
  /** List of registered repositories */
  repos: WorkspaceRepoConfig[];
  /** Workspace settings */
  settings?: Partial<WorkspaceSettings>;
}

/**
 * Repository configuration as stored in workspace.json
 */
export interface WorkspaceRepoConfig {
  /** Unique identifier */
  id: string;
  /** Display name */
  name: string;
  /** Relative path from workspace root */
  relativePath: string;
  /** Whether this is the default repo */
  isDefault: boolean;
  /** Main branch name */
  mainBranch?: string;
  /** Whether this repo is a symlink to an external location */
  isSymlink?: boolean;
  /** Original absolute path if this is a symlink */
  originalPath?: string;
}

/**
 * Result of detecting the project/workspace type at a given path.
 */
export type ProjectType = 'workspace' | 'standalone' | 'convertible';

/**
 * Detailed detection result with additional information.
 */
export interface ProjectTypeDetectionResult {
  /** The detected type */
  type: ProjectType;
  /** Path that was analyzed */
  path: string;
  /** Whether a .git directory exists at the root */
  hasGitRoot: boolean;
  /** Whether .auto-claude/workspace.json exists */
  hasWorkspaceConfig: boolean;
  /** Git repositories found in subdirectories (for 'convertible' type) */
  subRepos?: Array<{
    path: string;
    name: string;
  }>;
}

/**
 * Options for creating a new workspace.
 */
export interface CreateWorkspaceOptions {
  /** Workspace name */
  name: string;
  /** Root path for the workspace */
  path: string;
  /** Create the directory if it doesn't exist (for new workspaces) */
  createDirectory?: boolean;
  /** Initial repositories to include */
  repos?: Array<{
    relativePath: string;
    name?: string;
    isDefault?: boolean;
  }>;
}

/**
 * Options for adding a repository to a workspace.
 */
export interface AddRepoOptions {
  /** Workspace ID to add the repo to */
  workspaceId: string;
  /** Path to the repository (absolute or relative to workspace) */
  repoPath: string;
  /** Display name (defaults to directory name) */
  name?: string;
  /** Set as default repo */
  isDefault?: boolean;
}

/**
 * Schema for workspace-link.json file stored in each repository's .auto-claude/workspace-link.json
 * This file links a repository back to its parent workspace, enabling:
 * - CLI tools to detect workspace context when opened from a repo
 * - UI to show workspace relationship for standalone repos
 * - Easier navigation between workspace and its repositories
 */
export interface WorkspaceLink {
  /** Schema version for future migrations */
  version: number;
  /** Absolute path to the parent workspace */
  workspacePath: string;
  /** Name of the parent workspace */
  workspaceName: string;
  /** This repository's ID in the workspace */
  repoId: string;
  /** This repository's relative path from workspace root */
  relativePath: string;
  /** When this link was created */
  linkedAt: string;
  /** Whether this repo was added via symlink (external location) */
  isSymlink?: boolean;
  /** Path to the symlink in the workspace (if isSymlink is true) */
  symlinkPath?: string;
}

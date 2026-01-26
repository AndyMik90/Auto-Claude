import { ipcMain } from 'electron';
import { existsSync, readFileSync, writeFileSync, mkdirSync, unlinkSync, symlinkSync, lstatSync, readlinkSync } from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import type { IPCResult } from '../../shared/types';
import type {
  Workspace,
  WorkspaceRepo,
  WorkspaceConfig,
  WorkspaceLink,
  ProjectTypeDetectionResult,
  CreateWorkspaceOptions,
  AddRepoOptions
} from '../../shared/types/workspace';
import {
  detectProjectTypeDetailed,
  findGitReposInSubdirectories
} from '../project-initializer';

const WORKSPACE_CONFIG_VERSION = 1;
const WORKSPACE_LINK_VERSION = 1;

/**
 * Claude CLI local settings interface
 * The key is "permissions.additionalDirectories" according to Claude CLI documentation
 */
interface ClaudeLocalSettings {
  permissions?: {
    allow?: string[];
    deny?: string[];
    additionalDirectories?: string[];
  };
  [key: string]: unknown;
}

/**
 * Get the Claude CLI settings file path for a workspace
 */
function getClaudeSettingsPath(workspacePath: string): string {
  return path.join(workspacePath, '.claude', 'settings.local.json');
}

/**
 * Read Claude CLI local settings
 */
function readClaudeSettings(workspacePath: string): ClaudeLocalSettings {
  const settingsPath = getClaudeSettingsPath(workspacePath);
  if (!existsSync(settingsPath)) {
    return {};
  }
  try {
    const content = readFileSync(settingsPath, 'utf-8');
    return JSON.parse(content) as ClaudeLocalSettings;
  } catch {
    return {};
  }
}

/**
 * Write Claude CLI local settings
 */
function writeClaudeSettings(workspacePath: string, settings: ClaudeLocalSettings): void {
  const settingsPath = getClaudeSettingsPath(workspacePath);
  const settingsDir = path.dirname(settingsPath);

  // Ensure .claude directory exists
  if (!existsSync(settingsDir)) {
    mkdirSync(settingsDir, { recursive: true });
  }

  writeFileSync(settingsPath, JSON.stringify(settings, null, 2), 'utf-8');
}

/**
 * Add an external directory to Claude CLI settings
 * This allows Claude CLI to access files in the external repository
 */
function addExternalDirectoryToClaudeSettings(workspacePath: string, externalPath: string): void {
  const settings = readClaudeSettings(workspacePath);

  // Ensure permissions object exists
  if (!settings.permissions) {
    settings.permissions = {};
  }

  if (!settings.permissions.additionalDirectories) {
    settings.permissions.additionalDirectories = [];
  }

  // Avoid duplicates
  if (!settings.permissions.additionalDirectories.includes(externalPath)) {
    settings.permissions.additionalDirectories.push(externalPath);
    writeClaudeSettings(workspacePath, settings);
  }
}

/**
 * Remove an external directory from Claude CLI settings
 */
function removeExternalDirectoryFromClaudeSettings(workspacePath: string, externalPath: string): void {
  const settings = readClaudeSettings(workspacePath);

  if (!settings.permissions?.additionalDirectories) {
    return;
  }

  const index = settings.permissions.additionalDirectories.indexOf(externalPath);
  if (index !== -1) {
    settings.permissions.additionalDirectories.splice(index, 1);

    // Clean up empty array
    if (settings.permissions.additionalDirectories.length === 0) {
      delete settings.permissions.additionalDirectories;
    }

    // Clean up empty permissions object
    if (Object.keys(settings.permissions).length === 0) {
      delete settings.permissions;
    }

    writeClaudeSettings(workspacePath, settings);
  }
}

/**
 * Get the workspace config file path for a workspace
 */
function getWorkspaceConfigPath(workspacePath: string): string {
  return path.join(workspacePath, '.auto-claude', 'workspace.json');
}

/**
 * Get the workspace link file path for a repository
 */
function getWorkspaceLinkPath(repoPath: string): string {
  return path.join(repoPath, '.auto-claude', 'workspace-link.json');
}

/**
 * Create a workspace link file in a repository
 * This allows the repo to know which workspace it belongs to
 */
function createWorkspaceLink(
  repoPath: string,
  workspacePath: string,
  workspaceName: string,
  repoId: string,
  relativePath: string,
  symlinkInfo?: { isSymlink: boolean; symlinkPath: string }
): void {
  const linkPath = getWorkspaceLinkPath(repoPath);
  const linkDir = path.dirname(linkPath);

  // Ensure .auto-claude directory exists in repo
  if (!existsSync(linkDir)) {
    mkdirSync(linkDir, { recursive: true });
  }

  const link: WorkspaceLink = {
    version: WORKSPACE_LINK_VERSION,
    workspacePath,
    workspaceName,
    repoId,
    relativePath,
    linkedAt: new Date().toISOString(),
    ...(symlinkInfo && {
      isSymlink: symlinkInfo.isSymlink,
      symlinkPath: symlinkInfo.symlinkPath
    })
  };

  writeFileSync(linkPath, JSON.stringify(link, null, 2), 'utf-8');
}

/**
 * Check if a path is inside another path (is a subdirectory)
 */
function isPathInside(childPath: string, parentPath: string): boolean {
  const relative = path.relative(parentPath, childPath);
  return !relative.startsWith('..') && !path.isAbsolute(relative);
}

/**
 * Create a symlink for an external repository
 * Returns the symlink path (relative to workspace) or null if failed
 */
function createRepoSymlink(
  workspacePath: string,
  absoluteRepoPath: string,
  repoName: string
): string | null {
  // Create symlink in workspace root with repo name
  let symlinkName = repoName;
  let symlinkFullPath = path.join(workspacePath, symlinkName);

  // Handle name conflicts by appending a number
  let counter = 1;
  while (existsSync(symlinkFullPath)) {
    symlinkName = `${repoName}-${counter}`;
    symlinkFullPath = path.join(workspacePath, symlinkName);
    counter++;
  }

  try {
    // Create symbolic link (directory type)
    symlinkSync(absoluteRepoPath, symlinkFullPath, 'dir');
    return symlinkName;
  } catch (error) {
    console.error('Failed to create symlink:', error);
    return null;
  }
}

/**
 * Remove a symlink from workspace
 */
function removeRepoSymlink(workspacePath: string, relativePath: string): void {
  const symlinkPath = path.join(workspacePath, relativePath);
  try {
    // Check if it's a symlink before removing
    if (existsSync(symlinkPath)) {
      const stats = lstatSync(symlinkPath);
      if (stats.isSymbolicLink()) {
        unlinkSync(symlinkPath);
      }
    }
  } catch (error) {
    console.error('Failed to remove symlink:', error);
  }
}

/**
 * Remove the workspace link file from a repository
 */
function removeWorkspaceLink(repoPath: string): void {
  const linkPath = getWorkspaceLinkPath(repoPath);
  if (existsSync(linkPath)) {
    unlinkSync(linkPath);
  }
}

/**
 * Read workspace link from a repository
 */
function readWorkspaceLink(repoPath: string): WorkspaceLink | null {
  const linkPath = getWorkspaceLinkPath(repoPath);
  if (!existsSync(linkPath)) {
    return null;
  }
  try {
    const content = readFileSync(linkPath, 'utf-8');
    return JSON.parse(content) as WorkspaceLink;
  } catch {
    return null;
  }
}

/**
 * Generate CLAUDE.md file for a workspace
 * This file helps Claude CLI understand the workspace structure
 */
function generateWorkspaceClaudeMd(workspacePath: string, config: WorkspaceConfig): void {
  const claudeMdPath = path.join(workspacePath, 'CLAUDE.md');

  const repoList = config.repos.length > 0
    ? config.repos.map(r => {
        const defaultMark = r.isDefault ? ' (default)' : '';
        const symlinkMark = r.isSymlink ? ' (symlink)' : '';
        const originalPathNote = r.isSymlink && r.originalPath
          ? `\n  - Original location: \`${r.originalPath}\``
          : '';
        return `- **${r.name}**${defaultMark}${symlinkMark}: \`./${r.relativePath}\`${originalPathNote}`;
      }).join('\n')
    : '_No repositories added yet. Use the sidebar to add repositories._';

  // Check if there are any symlinked repos
  const hasSymlinks = config.repos.some(r => r.isSymlink);
  const symlinkNote = hasSymlinks
    ? `\n\n**Note:** Some repositories are symlinks to external locations. These are marked with "(symlink)" and their original paths are shown below each entry.`
    : '';

  const content = `# ${config.name}

This is an Auto-Claude workspace containing multiple repositories.

## Repositories

${repoList}${symlinkNote}

## Working with this Workspace

When working in this workspace:
1. Each repository listed above is a separate Git repository
2. Navigate to the specific repository directory to work on that codebase
3. The workspace configuration is stored in \`.auto-claude/workspace.json\`

## Quick Access

To access a repository, use the path shown above. For example:
\`\`\`bash
cd ./${config.repos[0]?.relativePath || 'repo-name'}
\`\`\`
`;

  writeFileSync(claudeMdPath, content, 'utf-8');
}

/**
 * Read workspace config from disk
 */
function readWorkspaceConfig(workspacePath: string): WorkspaceConfig | null {
  const configPath = getWorkspaceConfigPath(workspacePath);
  if (!existsSync(configPath)) {
    return null;
  }
  try {
    const content = readFileSync(configPath, 'utf-8');
    return JSON.parse(content) as WorkspaceConfig;
  } catch {
    return null;
  }
}

/**
 * Write workspace config to disk
 */
function writeWorkspaceConfig(workspacePath: string, config: WorkspaceConfig): void {
  const configPath = getWorkspaceConfigPath(workspacePath);
  const configDir = path.dirname(configPath);

  // Ensure .auto-claude directory exists
  if (!existsSync(configDir)) {
    mkdirSync(configDir, { recursive: true });
  }

  writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf-8');
}

/**
 * Convert WorkspaceConfig to Workspace
 */
function configToWorkspace(workspacePath: string, config: WorkspaceConfig): Workspace {
  const now = new Date();
  return {
    id: uuidv4(), // Generate ID on load (or store in config)
    name: config.name,
    path: workspacePath,
    repos: config.repos.map((r) => ({
      id: r.id,
      name: r.name,
      relativePath: r.relativePath,
      isDefault: r.isDefault,
      mainBranch: r.mainBranch
    })),
    settings: {
      model: config.settings?.model || 'claude-sonnet-4-20250514',
      memoryBackend: config.settings?.memoryBackend || 'graphiti',
      notifications: config.settings?.notifications || {
        onTaskComplete: true,
        onTaskFailed: true,
        onReviewNeeded: true,
        sound: true
      },
      graphitiMcpEnabled: config.settings?.graphitiMcpEnabled ?? true,
      graphitiMcpUrl: config.settings?.graphitiMcpUrl,
      useClaudeMd: config.settings?.useClaudeMd ?? true,
      maxParallelTasks: config.settings?.maxParallelTasks ?? 3
    },
    createdAt: now,
    updatedAt: now
  };
}

/**
 * Register all workspace-related IPC handlers
 */
export function registerWorkspaceHandlers(): void {
  /**
   * Get all workspaces (for now, returns empty - workspaces will be discovered from projects)
   */
  ipcMain.handle(
    'workspace:get-all',
    async (): Promise<IPCResult<Workspace[]>> => {
      try {
        // For now, return empty array - workspaces will be discovered from projects
        // In the future, we could maintain a registry of known workspaces
        return {
          success: true,
          data: []
        };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to get workspaces'
        };
      }
    }
  );

  /**
   * Create a new workspace
   */
  ipcMain.handle(
    'workspace:create',
    async (_event, options: CreateWorkspaceOptions): Promise<IPCResult<Workspace>> => {
      try {
        const { name, path: workspacePath, repos, createDirectory } = options;

        // Create directory if requested and doesn't exist
        if (createDirectory && !existsSync(workspacePath)) {
          try {
            mkdirSync(workspacePath, { recursive: true });
          } catch (mkdirError) {
            return {
              success: false,
              error: `Failed to create directory: ${mkdirError instanceof Error ? mkdirError.message : String(mkdirError)}`
            };
          }
        }

        // Validate path exists
        if (!existsSync(workspacePath)) {
          return {
            success: false,
            error: `Path does not exist: ${workspacePath}. createDirectory option: ${createDirectory}`
          };
        }

        // Check if workspace already exists
        const existingConfig = readWorkspaceConfig(workspacePath);
        if (existingConfig) {
          return {
            success: false,
            error: 'Workspace already exists at this path'
          };
        }

        // Create workspace config
        const config: WorkspaceConfig = {
          version: WORKSPACE_CONFIG_VERSION,
          name,
          repos: (repos || []).map((r, index) => ({
            id: uuidv4(),
            name: r.name || path.basename(r.relativePath),
            relativePath: r.relativePath,
            isDefault: r.isDefault ?? index === 0
          }))
        };

        // Write config
        writeWorkspaceConfig(workspacePath, config);

        // Create required directories
        const autoClaude = path.join(workspacePath, '.auto-claude');
        for (const dir of ['specs', 'ideation', 'insights', 'roadmap']) {
          const dirPath = path.join(autoClaude, dir);
          if (!existsSync(dirPath)) {
            mkdirSync(dirPath, { recursive: true });
          }
        }

        // Generate CLAUDE.md for the workspace
        generateWorkspaceClaudeMd(workspacePath, config);

        // Return workspace
        const workspace = configToWorkspace(workspacePath, config);
        return {
          success: true,
          data: workspace
        };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to create workspace'
        };
      }
    }
  );

  /**
   * Add a repository to a workspace
   */
  ipcMain.handle(
    'workspace:add-repo',
    async (_event, options: AddRepoOptions): Promise<IPCResult<WorkspaceRepo>> => {
      try {
        const { workspaceId, repoPath, name, isDefault } = options;

        // For now, workspaceId is the workspace path
        // In a full implementation, we'd have a registry mapping IDs to paths
        const workspacePath = workspaceId;

        const config = readWorkspaceConfig(workspacePath);
        if (!config) {
          return {
            success: false,
            error: 'Workspace not found'
          };
        }

        // Calculate absolute path
        const absoluteRepoPath = path.isAbsolute(repoPath)
          ? repoPath
          : path.join(workspacePath, repoPath);

        // Validate repo path exists and is a git repo
        if (!existsSync(absoluteRepoPath)) {
          return {
            success: false,
            error: `Repository path does not exist: ${absoluteRepoPath}`
          };
        }

        if (!existsSync(path.join(absoluteRepoPath, '.git'))) {
          return {
            success: false,
            error: 'Path is not a Git repository'
          };
        }

        // Check if repo is outside the workspace (external)
        const isExternal = !isPathInside(absoluteRepoPath, workspacePath);
        const repoName = name || path.basename(absoluteRepoPath);

        let relativePath: string;
        let isSymlink = false;
        let originalPath: string | undefined;
        let symlinkPath: string | undefined;

        if (isExternal) {
          // Create symlink for external repository
          const symlinkName = createRepoSymlink(workspacePath, absoluteRepoPath, repoName);
          if (!symlinkName) {
            return {
              success: false,
              error: 'Failed to create symlink for external repository. Check permissions.'
            };
          }
          relativePath = symlinkName;
          isSymlink = true;
          originalPath = absoluteRepoPath;
          symlinkPath = path.join(workspacePath, symlinkName);
        } else {
          // Internal repository - use relative path directly
          relativePath = path.relative(workspacePath, absoluteRepoPath);
        }

        // Check if repo already exists (by original path for symlinks, or relative path for internal)
        const existingRepo = config.repos.find((r) => {
          if (isSymlink) {
            return r.originalPath === absoluteRepoPath;
          }
          return r.relativePath === relativePath;
        });

        if (existingRepo) {
          // Clean up symlink if we created one
          if (isSymlink && symlinkPath) {
            removeRepoSymlink(workspacePath, relativePath);
          }
          return {
            success: false,
            error: 'Repository already exists in workspace'
          };
        }

        // Create repo entry
        const repo: WorkspaceRepo = {
          id: uuidv4(),
          name: repoName,
          relativePath,
          isDefault: isDefault ?? config.repos.length === 0
        };

        // If setting as default, clear other defaults
        if (repo.isDefault) {
          config.repos.forEach((r) => (r.isDefault = false));
        }

        // Add to config with symlink info
        config.repos.push({
          id: repo.id,
          name: repo.name,
          relativePath: repo.relativePath,
          isDefault: repo.isDefault,
          ...(isSymlink && {
            isSymlink: true,
            originalPath
          })
        });

        // Write config
        writeWorkspaceConfig(workspacePath, config);

        // Create workspace link file in the repository
        // This allows the repo to know which workspace it belongs to
        createWorkspaceLink(
          absoluteRepoPath,
          workspacePath,
          config.name,
          repo.id,
          relativePath,
          isSymlink ? { isSymlink: true, symlinkPath: symlinkPath! } : undefined
        );

        // If this is an external repo (symlink), add its path to Claude CLI settings
        // This allows Claude CLI to access files in the external repository
        if (isSymlink && originalPath) {
          addExternalDirectoryToClaudeSettings(workspacePath, originalPath);
        }

        // Regenerate CLAUDE.md to include the new repository
        generateWorkspaceClaudeMd(workspacePath, config);

        return {
          success: true,
          data: repo
        };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to add repository'
        };
      }
    }
  );

  /**
   * Remove a repository from a workspace
   */
  ipcMain.handle(
    'workspace:remove-repo',
    async (_event, workspaceId: string, repoId: string): Promise<IPCResult<void>> => {
      try {
        const workspacePath = workspaceId;

        const config = readWorkspaceConfig(workspacePath);
        if (!config) {
          return {
            success: false,
            error: 'Workspace not found'
          };
        }

        const repoIndex = config.repos.findIndex((r) => r.id === repoId);
        if (repoIndex === -1) {
          return {
            success: false,
            error: 'Repository not found in workspace'
          };
        }

        // Get repo info before removing
        const removedRepo = config.repos[repoIndex];

        // For symlinks, use the original path; for internal repos, use the relative path
        const absoluteRepoPath = removedRepo.isSymlink && removedRepo.originalPath
          ? removedRepo.originalPath
          : path.join(workspacePath, removedRepo.relativePath);

        // Remove repo from config
        const wasDefault = removedRepo.isDefault;
        config.repos.splice(repoIndex, 1);

        // If removed repo was default, make first repo default
        if (wasDefault && config.repos.length > 0) {
          config.repos[0].isDefault = true;
        }

        // Write config
        writeWorkspaceConfig(workspacePath, config);

        // Remove workspace link file from the repository
        removeWorkspaceLink(absoluteRepoPath);

        // If this was a symlink, remove the symlink and its Claude CLI settings entry
        if (removedRepo.isSymlink) {
          removeRepoSymlink(workspacePath, removedRepo.relativePath);

          // Remove external directory from Claude CLI settings
          if (removedRepo.originalPath) {
            removeExternalDirectoryFromClaudeSettings(workspacePath, removedRepo.originalPath);
          }
        }

        // Regenerate CLAUDE.md to reflect the removal
        generateWorkspaceClaudeMd(workspacePath, config);

        return { success: true };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to remove repository'
        };
      }
    }
  );

  /**
   * Set default repository for a workspace
   */
  ipcMain.handle(
    'workspace:set-default-repo',
    async (_event, workspaceId: string, repoId: string): Promise<IPCResult<void>> => {
      try {
        const workspacePath = workspaceId;

        const config = readWorkspaceConfig(workspacePath);
        if (!config) {
          return {
            success: false,
            error: 'Workspace not found'
          };
        }

        const repo = config.repos.find((r) => r.id === repoId);
        if (!repo) {
          return {
            success: false,
            error: 'Repository not found in workspace'
          };
        }

        // Update defaults
        config.repos.forEach((r) => (r.isDefault = r.id === repoId));

        // Write config
        writeWorkspaceConfig(workspacePath, config);

        return { success: true };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to set default repository'
        };
      }
    }
  );

  /**
   * Detect project type at a given path
   */
  ipcMain.handle(
    'workspace:detect-type',
    async (_event, dirPath: string): Promise<IPCResult<ProjectTypeDetectionResult>> => {
      try {
        const result = detectProjectTypeDetailed(dirPath);
        return {
          success: true,
          data: result
        };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to detect project type'
        };
      }
    }
  );

  /**
   * Delete a workspace (removes workspace.json only, keeps repos)
   */
  ipcMain.handle(
    'workspace:delete',
    async (_event, workspaceId: string): Promise<IPCResult<void>> => {
      try {
        const workspacePath = workspaceId;
        const configPath = getWorkspaceConfigPath(workspacePath);

        if (!existsSync(configPath)) {
          return {
            success: false,
            error: 'Workspace not found'
          };
        }

        // Only delete the workspace.json, not the .auto-claude directory
        // This allows the project to revert to standalone mode
        const { unlinkSync } = await import('fs');
        unlinkSync(configPath);

        return { success: true };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to delete workspace'
        };
      }
    }
  );

  /**
   * Get workspace at a specific path
   */
  ipcMain.handle(
    'workspace:get',
    async (_event, workspacePath: string): Promise<IPCResult<Workspace | null>> => {
      try {
        const config = readWorkspaceConfig(workspacePath);
        if (!config) {
          return {
            success: true,
            data: null
          };
        }

        const workspace = configToWorkspace(workspacePath, config);
        return {
          success: true,
          data: workspace
        };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to get workspace'
        };
      }
    }
  );

  /**
   * Get workspace link from a repository
   * Returns the link info if this repo belongs to a workspace, null otherwise
   */
  ipcMain.handle(
    'workspace:get-link',
    async (_event, repoPath: string): Promise<IPCResult<WorkspaceLink | null>> => {
      try {
        const link = readWorkspaceLink(repoPath);
        return {
          success: true,
          data: link
        };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to read workspace link'
        };
      }
    }
  );
}

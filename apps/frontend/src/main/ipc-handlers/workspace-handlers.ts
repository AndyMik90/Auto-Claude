import { ipcMain } from 'electron';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import type { IPCResult } from '../../shared/types';
import type {
  Workspace,
  WorkspaceRepo,
  WorkspaceConfig,
  ProjectTypeDetectionResult,
  CreateWorkspaceOptions,
  AddRepoOptions
} from '../../shared/types/workspace';
import {
  detectProjectTypeDetailed,
  findGitReposInSubdirectories
} from '../project-initializer';

const WORKSPACE_CONFIG_VERSION = 1;

/**
 * Get the workspace config file path for a workspace
 */
function getWorkspaceConfigPath(workspacePath: string): string {
  return path.join(workspacePath, '.auto-claude', 'workspace.json');
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
        const { name, path: workspacePath, repos } = options;

        // Validate path exists
        if (!existsSync(workspacePath)) {
          return {
            success: false,
            error: `Path does not exist: ${workspacePath}`
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

        // Calculate relative path
        const absoluteRepoPath = path.isAbsolute(repoPath)
          ? repoPath
          : path.join(workspacePath, repoPath);
        const relativePath = path.relative(workspacePath, absoluteRepoPath);

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

        // Check if repo already exists
        if (config.repos.some((r) => r.relativePath === relativePath)) {
          return {
            success: false,
            error: 'Repository already exists in workspace'
          };
        }

        // Create repo entry
        const repo: WorkspaceRepo = {
          id: uuidv4(),
          name: name || path.basename(absoluteRepoPath),
          relativePath,
          isDefault: isDefault ?? config.repos.length === 0
        };

        // If setting as default, clear other defaults
        if (repo.isDefault) {
          config.repos.forEach((r) => (r.isDefault = false));
        }

        // Add to config
        config.repos.push({
          id: repo.id,
          name: repo.name,
          relativePath: repo.relativePath,
          isDefault: repo.isDefault
        });

        // Write config
        writeWorkspaceConfig(workspacePath, config);

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

        // Remove repo
        const wasDefault = config.repos[repoIndex].isDefault;
        config.repos.splice(repoIndex, 1);

        // If removed repo was default, make first repo default
        if (wasDefault && config.repos.length > 0) {
          config.repos[0].isDefault = true;
        }

        // Write config
        writeWorkspaceConfig(workspacePath, config);

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
}

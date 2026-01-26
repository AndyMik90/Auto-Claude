import type { IPCResult } from '../../../shared/types';
import type {
  Workspace,
  WorkspaceRepo,
  ProjectTypeDetectionResult,
  CreateWorkspaceOptions,
  AddRepoOptions
} from '../../../shared/types/workspace';
import { invokeIpc } from './ipc-utils';

/**
 * Workspace API operations for multi-repository support
 */
export interface WorkspaceAPI {
  /** Get all known workspaces */
  getWorkspaces: () => Promise<IPCResult<Workspace[]>>;

  /** Get workspace at a specific path */
  getWorkspace: (workspacePath: string) => Promise<IPCResult<Workspace | null>>;

  /** Create a new workspace */
  createWorkspace: (options: CreateWorkspaceOptions) => Promise<IPCResult<Workspace>>;

  /** Add a repository to a workspace */
  addRepoToWorkspace: (options: AddRepoOptions) => Promise<IPCResult<WorkspaceRepo>>;

  /** Remove a repository from a workspace */
  removeRepoFromWorkspace: (workspaceId: string, repoId: string) => Promise<IPCResult<void>>;

  /** Set the default repository for a workspace */
  setDefaultRepo: (workspaceId: string, repoId: string) => Promise<IPCResult<void>>;

  /** Detect project type at a given path */
  detectProjectType: (path: string) => Promise<IPCResult<ProjectTypeDetectionResult>>;

  /** Delete a workspace (keeps repos, removes workspace.json) */
  deleteWorkspace: (workspaceId: string) => Promise<IPCResult<void>>;
}

/**
 * Creates the Workspace API implementation
 */
export const createWorkspaceAPI = (): WorkspaceAPI => ({
  getWorkspaces: (): Promise<IPCResult<Workspace[]>> =>
    invokeIpc('workspace:get-all'),

  getWorkspace: (workspacePath: string): Promise<IPCResult<Workspace | null>> =>
    invokeIpc('workspace:get', workspacePath),

  createWorkspace: (options: CreateWorkspaceOptions): Promise<IPCResult<Workspace>> =>
    invokeIpc('workspace:create', options),

  addRepoToWorkspace: (options: AddRepoOptions): Promise<IPCResult<WorkspaceRepo>> =>
    invokeIpc('workspace:add-repo', options),

  removeRepoFromWorkspace: (workspaceId: string, repoId: string): Promise<IPCResult<void>> =>
    invokeIpc('workspace:remove-repo', workspaceId, repoId),

  setDefaultRepo: (workspaceId: string, repoId: string): Promise<IPCResult<void>> =>
    invokeIpc('workspace:set-default-repo', workspaceId, repoId),

  detectProjectType: (path: string): Promise<IPCResult<ProjectTypeDetectionResult>> =>
    invokeIpc('workspace:detect-type', path),

  deleteWorkspace: (workspaceId: string): Promise<IPCResult<void>> =>
    invokeIpc('workspace:delete', workspaceId)
});

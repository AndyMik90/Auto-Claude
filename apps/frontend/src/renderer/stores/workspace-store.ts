import { create } from 'zustand';
import type {
  Workspace,
  WorkspaceRepo,
  ProjectType,
  ProjectTypeDetectionResult,
  CreateWorkspaceOptions,
  AddRepoOptions
} from '../../shared/types/workspace';

interface WorkspaceState {
  // State
  workspaces: Workspace[];
  activeWorkspaceId: string | null;
  activeRepoId: string | null;
  isLoading: boolean;
  error: string | null;

  // Detection state
  detectionResult: ProjectTypeDetectionResult | null;
  isDetecting: boolean;

  // Actions
  setWorkspaces: (workspaces: Workspace[]) => void;
  setActiveWorkspace: (workspaceId: string | null) => void;
  setActiveRepo: (repoId: string | null) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  setDetectionResult: (result: ProjectTypeDetectionResult | null) => void;

  // Async actions
  loadWorkspaces: () => Promise<void>;
  createWorkspace: (options: CreateWorkspaceOptions) => Promise<Workspace | null>;
  addRepoToWorkspace: (options: AddRepoOptions) => Promise<boolean>;
  removeRepoFromWorkspace: (workspaceId: string, repoId: string) => Promise<boolean>;
  setDefaultRepo: (workspaceId: string, repoId: string) => Promise<boolean>;
  detectProjectType: (path: string) => Promise<ProjectTypeDetectionResult | null>;
  deleteWorkspace: (workspaceId: string) => Promise<boolean>;
}

export const useWorkspaceStore = create<WorkspaceState>((set, get) => ({
  // Initial state
  workspaces: [],
  activeWorkspaceId: null,
  activeRepoId: null,
  isLoading: false,
  error: null,
  detectionResult: null,
  isDetecting: false,

  // Setters
  setWorkspaces: (workspaces) => set({ workspaces }),
  setActiveWorkspace: (activeWorkspaceId) => set({ activeWorkspaceId }),
  setActiveRepo: (activeRepoId) => set({ activeRepoId }),
  setLoading: (isLoading) => set({ isLoading }),
  setError: (error) => set({ error }),
  setDetectionResult: (detectionResult) => set({ detectionResult }),

  // Load all workspaces
  loadWorkspaces: async () => {
    set({ isLoading: true, error: null });
    try {
      const result = await window.electronAPI.getWorkspaces();
      if (result.success && result.data) {
        set({ workspaces: result.data, isLoading: false });
      } else {
        set({ error: result.error || 'Failed to load workspaces', isLoading: false });
      }
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to load workspaces',
        isLoading: false
      });
    }
  },

  // Create a new workspace
  createWorkspace: async (options: CreateWorkspaceOptions) => {
    set({ isLoading: true, error: null });
    try {
      const result = await window.electronAPI.createWorkspace(options);
      if (result.success && result.data) {
        // Add to local state
        set((state) => ({
          workspaces: [...state.workspaces, result.data!],
          activeWorkspaceId: result.data!.id,
          isLoading: false
        }));
        return result.data;
      }
      set({ error: result.error || 'Failed to create workspace', isLoading: false });
      return null;
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to create workspace',
        isLoading: false
      });
      return null;
    }
  },

  // Add a repository to a workspace
  addRepoToWorkspace: async (options: AddRepoOptions) => {
    set({ isLoading: true, error: null });
    try {
      const result = await window.electronAPI.addRepoToWorkspace(options);
      if (result.success && result.data) {
        // Update workspace in local state
        set((state) => ({
          workspaces: state.workspaces.map((ws) =>
            ws.id === options.workspaceId
              ? { ...ws, repos: [...ws.repos, result.data!] }
              : ws
          ),
          isLoading: false
        }));
        return true;
      }
      set({ error: result.error || 'Failed to add repository', isLoading: false });
      return false;
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to add repository',
        isLoading: false
      });
      return false;
    }
  },

  // Remove a repository from a workspace
  removeRepoFromWorkspace: async (workspaceId: string, repoId: string) => {
    set({ isLoading: true, error: null });
    try {
      const result = await window.electronAPI.removeRepoFromWorkspace(workspaceId, repoId);
      if (result.success) {
        // Update workspace in local state
        set((state) => ({
          workspaces: state.workspaces.map((ws) =>
            ws.id === workspaceId
              ? { ...ws, repos: ws.repos.filter((r) => r.id !== repoId) }
              : ws
          ),
          activeRepoId: state.activeRepoId === repoId ? null : state.activeRepoId,
          isLoading: false
        }));
        return true;
      }
      set({ error: result.error || 'Failed to remove repository', isLoading: false });
      return false;
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to remove repository',
        isLoading: false
      });
      return false;
    }
  },

  // Set default repository for a workspace
  setDefaultRepo: async (workspaceId: string, repoId: string) => {
    set({ isLoading: true, error: null });
    try {
      const result = await window.electronAPI.setDefaultRepo(workspaceId, repoId);
      if (result.success) {
        // Update workspace in local state
        set((state) => ({
          workspaces: state.workspaces.map((ws) =>
            ws.id === workspaceId
              ? {
                  ...ws,
                  repos: ws.repos.map((r) => ({
                    ...r,
                    isDefault: r.id === repoId
                  }))
                }
              : ws
          ),
          isLoading: false
        }));
        return true;
      }
      set({ error: result.error || 'Failed to set default repository', isLoading: false });
      return false;
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to set default repository',
        isLoading: false
      });
      return false;
    }
  },

  // Detect project type at a given path
  detectProjectType: async (path: string) => {
    set({ isDetecting: true, detectionResult: null, error: null });
    try {
      const result = await window.electronAPI.detectProjectType(path);
      if (result.success && result.data) {
        set({ detectionResult: result.data, isDetecting: false });
        return result.data;
      }
      set({ error: result.error || 'Failed to detect project type', isDetecting: false });
      return null;
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to detect project type',
        isDetecting: false
      });
      return null;
    }
  },

  // Delete a workspace
  deleteWorkspace: async (workspaceId: string) => {
    set({ isLoading: true, error: null });
    try {
      const result = await window.electronAPI.deleteWorkspace(workspaceId);
      if (result.success) {
        set((state) => ({
          workspaces: state.workspaces.filter((ws) => ws.id !== workspaceId),
          activeWorkspaceId: state.activeWorkspaceId === workspaceId ? null : state.activeWorkspaceId,
          activeRepoId: state.activeWorkspaceId === workspaceId ? null : state.activeRepoId,
          isLoading: false
        }));
        return true;
      }
      set({ error: result.error || 'Failed to delete workspace', isLoading: false });
      return false;
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to delete workspace',
        isLoading: false
      });
      return false;
    }
  }
}));

// Helper selectors
export const getActiveWorkspace = (): Workspace | null => {
  const state = useWorkspaceStore.getState();
  return state.workspaces.find((ws) => ws.id === state.activeWorkspaceId) || null;
};

export const getActiveRepo = (): WorkspaceRepo | null => {
  const workspace = getActiveWorkspace();
  if (!workspace) return null;
  const state = useWorkspaceStore.getState();
  return workspace.repos.find((r) => r.id === state.activeRepoId) || null;
};

export const getDefaultRepo = (workspaceId: string): WorkspaceRepo | null => {
  const state = useWorkspaceStore.getState();
  const workspace = state.workspaces.find((ws) => ws.id === workspaceId);
  if (!workspace) return null;
  return workspace.repos.find((r) => r.isDefault) || workspace.repos[0] || null;
};

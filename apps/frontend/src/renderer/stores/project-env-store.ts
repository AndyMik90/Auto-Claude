import { create } from 'zustand';
import type { ProjectEnvConfig } from '../../shared/types';

interface ProjectEnvState {
  // State
  envConfig: ProjectEnvConfig | null;
  projectId: string | null;
  isLoading: boolean;
  error: string | null;

  // Actions
  setEnvConfig: (projectId: string | null, config: ProjectEnvConfig | null) => void;
  setEnvConfigOnly: (projectId: string | null, config: ProjectEnvConfig | null) => void;
  updateEnvConfig: (updates: Partial<ProjectEnvConfig>) => void;
  clearEnvConfig: () => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
}

// Track the current pending request to handle race conditions
let currentRequestId = 0;

export const useProjectEnvStore = create<ProjectEnvState>((set, get) => ({
  // Initial state
  envConfig: null,
  projectId: null,
  isLoading: false,
  error: null,

  // Actions
  // setEnvConfig clears error - used for successful config loads
  setEnvConfig: (projectId, envConfig) => set({
    projectId,
    envConfig,
    error: null
  }),

  // setEnvConfigOnly updates config without touching error state - used in error cases
  setEnvConfigOnly: (projectId, envConfig) => set({
    projectId,
    envConfig
  }),

  updateEnvConfig: (updates) =>
    set((state) => ({
      envConfig: state.envConfig
        ? { ...state.envConfig, ...updates }
        : null
    })),

  clearEnvConfig: () => set({
    envConfig: null,
    projectId: null,
    error: null
  }),

  setLoading: (isLoading) => set({ isLoading }),

  setError: (error) => set({ error })
}));

/**
 * Load project environment config from main process.
 * Updates the store with the loaded config.
 * Handles race conditions when called rapidly for different projects.
 */
export async function loadProjectEnvConfig(projectId: string): Promise<ProjectEnvConfig | null> {
  const store = useProjectEnvStore.getState();

  // Increment request ID to track this specific request
  const requestId = ++currentRequestId;

  store.setLoading(true);
  store.setError(null);

  try {
    const result = await window.electronAPI.getProjectEnv(projectId);

    // Check if this request is still the current one (handle race conditions)
    if (requestId !== currentRequestId) {
      // A newer request was made, ignore this result
      return null;
    }

    if (result.success && result.data) {
      store.setEnvConfig(projectId, result.data);
      return result.data;
    } else {
      // Use setEnvConfigOnly to update config without clearing the error we're about to set
      store.setEnvConfigOnly(projectId, null);
      store.setError(result.error || 'Failed to load environment config');
      return null;
    }
  } catch (error) {
    // Check if this request is still the current one
    if (requestId !== currentRequestId) {
      return null;
    }

    // Use setEnvConfigOnly to update config without clearing the error we're about to set
    store.setEnvConfigOnly(projectId, null);
    store.setError(error instanceof Error ? error.message : 'Unknown error');
    return null;
  } finally {
    // Only update loading state if this is still the current request
    if (requestId === currentRequestId) {
      store.setLoading(false);
    }
  }
}

/**
 * Set project env config directly (for use by useProjectSettings hook).
 * This is a standalone function for use outside React components.
 */
export function setProjectEnvConfig(projectId: string, config: ProjectEnvConfig | null): void {
  const store = useProjectEnvStore.getState();
  store.setEnvConfig(projectId, config);
}

/**
 * Clear the project env config (for use when switching projects or closing dialogs).
 * This is a standalone function for use outside React components.
 */
export function clearProjectEnvConfig(): void {
  const store = useProjectEnvStore.getState();
  store.clearEnvConfig();
}

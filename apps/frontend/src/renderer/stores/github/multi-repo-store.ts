/**
 * GitHub Multi-Repository Store
 * Manages multiple repository configurations per project
 */

import { create } from 'zustand';
import type {
  GitHubMultiRepoConfig,
  GitHubRepoConfig,
  GitHubMultiRepoSyncStatus,
  GitHubRepoSyncStatus
} from '../../../shared/types';

interface MultiRepoState {
  // Configuration
  config: GitHubMultiRepoConfig | null;
  isConfigLoading: boolean;
  configError: string | null;

  // Sync status for all repositories
  syncStatus: GitHubMultiRepoSyncStatus | null;
  isSyncStatusLoading: boolean;
  syncStatusError: string | null;

  // Currently selected repository (for filtering issues/PRs)
  selectedRepo: string | null;

  // Actions - Configuration
  setConfig: (config: GitHubMultiRepoConfig | null) => void;
  setConfigLoading: (loading: boolean) => void;
  setConfigError: (error: string | null) => void;

  // Actions - Sync Status
  setSyncStatus: (status: GitHubMultiRepoSyncStatus | null) => void;
  setSyncStatusLoading: (loading: boolean) => void;
  setSyncStatusError: (error: string | null) => void;
  updateRepoSyncStatus: (repo: string, status: GitHubRepoSyncStatus) => void;

  // Actions - Selection
  setSelectedRepo: (repo: string | null) => void;

  // Actions - Clear
  clearAll: () => void;

  // Selectors
  getRepos: () => GitHubRepoConfig[];
  getEnabledRepos: () => GitHubRepoConfig[];
  getDefaultRepo: () => string | null;
  getRepoConfig: (repo: string) => GitHubRepoConfig | null;
  getRepoSyncStatus: (repo: string) => GitHubRepoSyncStatus | null;
  isAnyRepoConnected: () => boolean;
  getTotalIssueCount: () => number;
  getTotalPRCount: () => number;
}

export const useMultiRepoStore = create<MultiRepoState>((set, get) => ({
  // Initial state
  config: null,
  isConfigLoading: false,
  configError: null,
  syncStatus: null,
  isSyncStatusLoading: false,
  syncStatusError: null,
  selectedRepo: null,

  // Actions - Configuration
  setConfig: (config) => set({ config, configError: null }),

  setConfigLoading: (isConfigLoading) => set({ isConfigLoading }),

  setConfigError: (configError) => set({ configError, isConfigLoading: false }),

  // Actions - Sync Status
  setSyncStatus: (syncStatus) => set({ syncStatus, syncStatusError: null }),

  setSyncStatusLoading: (isSyncStatusLoading) => set({ isSyncStatusLoading }),

  setSyncStatusError: (syncStatusError) => set({ syncStatusError, isSyncStatusLoading: false }),

  updateRepoSyncStatus: (repo, status) => set((state) => {
    if (!state.syncStatus) return state;

    const updatedRepos = state.syncStatus.repos.map((r) =>
      r.repo === repo ? status : r
    );

    // Recalculate aggregated values
    const connectedRepos = updatedRepos.filter((r) => r.connected);
    const totalIssueCount = updatedRepos.reduce((sum, r) => sum + (r.issueCount || 0), 0);
    const totalPrCount = updatedRepos.reduce((sum, r) => sum + (r.prCount || 0), 0);

    return {
      syncStatus: {
        ...state.syncStatus,
        repos: updatedRepos,
        connected: connectedRepos.length > 0,
        totalIssueCount,
        totalPrCount
      }
    };
  }),

  // Actions - Selection
  setSelectedRepo: (selectedRepo) => set({ selectedRepo }),

  // Actions - Clear
  clearAll: () => set({
    config: null,
    isConfigLoading: false,
    configError: null,
    syncStatus: null,
    isSyncStatusLoading: false,
    syncStatusError: null,
    selectedRepo: null
  }),

  // Selectors
  getRepos: () => {
    const { config } = get();
    return config?.repos || [];
  },

  getEnabledRepos: () => {
    const { config } = get();
    return config?.repos.filter((r) => r.enabled) || [];
  },

  getDefaultRepo: () => {
    const { config } = get();
    if (!config) return null;

    // Use explicit default if set
    if (config.defaultRepo) {
      const exists = config.repos.some((r) => r.repo === config.defaultRepo && r.enabled);
      if (exists) return config.defaultRepo;
    }

    // Fall back to first enabled repo
    const firstEnabled = config.repos.find((r) => r.enabled);
    return firstEnabled?.repo || null;
  },

  getRepoConfig: (repo) => {
    const { config } = get();
    return config?.repos.find((r) => r.repo === repo) || null;
  },

  getRepoSyncStatus: (repo) => {
    const { syncStatus } = get();
    return syncStatus?.repos.find((r) => r.repo === repo) || null;
  },

  isAnyRepoConnected: () => {
    const { syncStatus } = get();
    return syncStatus?.connected ?? false;
  },

  getTotalIssueCount: () => {
    const { syncStatus } = get();
    return syncStatus?.totalIssueCount ?? 0;
  },

  getTotalPRCount: () => {
    const { syncStatus } = get();
    return syncStatus?.totalPrCount ?? 0;
  }
}));

// Action functions for use outside of React components

/**
 * Load multi-repo configuration for a project
 */
export async function loadMultiRepoConfig(projectId: string): Promise<GitHubMultiRepoConfig | null> {
  const store = useMultiRepoStore.getState();
  store.setConfigLoading(true);
  store.setConfigError(null);

  try {
    const result = await window.electronAPI.github.getMultiRepoConfig(projectId);
    if (result.success && result.data) {
      store.setConfig(result.data);
      return result.data;
    } else {
      store.setConfigError(result.error || 'Failed to load multi-repo configuration');
      return null;
    }
  } catch (error) {
    store.setConfigError(error instanceof Error ? error.message : 'Unknown error');
    return null;
  } finally {
    store.setConfigLoading(false);
  }
}

/**
 * Save multi-repo configuration
 */
export async function saveMultiRepoConfig(
  projectId: string,
  config: GitHubMultiRepoConfig
): Promise<boolean> {
  const store = useMultiRepoStore.getState();
  store.setConfigLoading(true);

  try {
    const result = await window.electronAPI.github.saveMultiRepoConfig(projectId, config);
    if (result.success) {
      store.setConfig(config);
      return true;
    } else {
      store.setConfigError(result.error || 'Failed to save configuration');
      return false;
    }
  } catch (error) {
    store.setConfigError(error instanceof Error ? error.message : 'Unknown error');
    return false;
  } finally {
    store.setConfigLoading(false);
  }
}

/**
 * Add a repository to the configuration
 */
export async function addRepository(
  projectId: string,
  repoConfig: GitHubRepoConfig
): Promise<boolean> {
  const store = useMultiRepoStore.getState();
  store.setConfigLoading(true);

  try {
    const result = await window.electronAPI.github.addRepository(projectId, repoConfig);
    if (result.success && result.data) {
      store.setConfig(result.data);
      return true;
    } else {
      store.setConfigError(result.error || 'Failed to add repository');
      return false;
    }
  } catch (error) {
    store.setConfigError(error instanceof Error ? error.message : 'Unknown error');
    return false;
  } finally {
    store.setConfigLoading(false);
  }
}

/**
 * Remove a repository from the configuration
 */
export async function removeRepository(projectId: string, repo: string): Promise<boolean> {
  const store = useMultiRepoStore.getState();
  store.setConfigLoading(true);

  try {
    const result = await window.electronAPI.github.removeRepository(projectId, repo);
    if (result.success && result.data) {
      store.setConfig(result.data);

      // Clear selection if removed repo was selected
      if (store.selectedRepo === repo) {
        store.setSelectedRepo(null);
      }
      return true;
    } else {
      store.setConfigError(result.error || 'Failed to remove repository');
      return false;
    }
  } catch (error) {
    store.setConfigError(error instanceof Error ? error.message : 'Unknown error');
    return false;
  } finally {
    store.setConfigLoading(false);
  }
}

/**
 * Update a repository in the configuration
 */
export async function updateRepository(
  projectId: string,
  repoConfig: GitHubRepoConfig
): Promise<boolean> {
  const store = useMultiRepoStore.getState();
  store.setConfigLoading(true);

  try {
    const result = await window.electronAPI.github.updateRepository(projectId, repoConfig);
    if (result.success && result.data) {
      store.setConfig(result.data);
      return true;
    } else {
      store.setConfigError(result.error || 'Failed to update repository');
      return false;
    }
  } catch (error) {
    store.setConfigError(error instanceof Error ? error.message : 'Unknown error');
    return false;
  } finally {
    store.setConfigLoading(false);
  }
}

/**
 * Set the default repository
 */
export async function setDefaultRepository(projectId: string, repo: string): Promise<boolean> {
  const store = useMultiRepoStore.getState();
  store.setConfigLoading(true);

  try {
    const result = await window.electronAPI.github.setDefaultRepository(projectId, repo);
    if (result.success && result.data) {
      store.setConfig(result.data);
      return true;
    } else {
      store.setConfigError(result.error || 'Failed to set default repository');
      return false;
    }
  } catch (error) {
    store.setConfigError(error instanceof Error ? error.message : 'Unknown error');
    return false;
  } finally {
    store.setConfigLoading(false);
  }
}

/**
 * Check connection status for all configured repositories
 */
export async function checkAllRepoConnections(
  projectId: string
): Promise<GitHubMultiRepoSyncStatus | null> {
  const store = useMultiRepoStore.getState();
  store.setSyncStatusLoading(true);
  store.setSyncStatusError(null);

  try {
    const result = await window.electronAPI.github.checkAllConnections(projectId);
    if (result.success && result.data) {
      store.setSyncStatus(result.data);
      return result.data;
    } else {
      store.setSyncStatusError(result.error || 'Failed to check connections');
      return null;
    }
  } catch (error) {
    store.setSyncStatusError(error instanceof Error ? error.message : 'Unknown error');
    return null;
  } finally {
    store.setSyncStatusLoading(false);
  }
}

/**
 * Migrate from legacy single-repo to multi-repo configuration
 */
export async function migrateToMultiRepo(
  projectId: string
): Promise<{ migrated: boolean; config?: GitHubMultiRepoConfig }> {
  const store = useMultiRepoStore.getState();
  store.setConfigLoading(true);

  try {
    const result = await window.electronAPI.github.migrateToMultiRepo(projectId);
    if (result.success && result.data) {
      if (result.data.config) {
        store.setConfig(result.data.config);
      }
      return result.data;
    } else {
      store.setConfigError(result.error || 'Migration failed');
      return { migrated: false };
    }
  } catch (error) {
    store.setConfigError(error instanceof Error ? error.message : 'Unknown error');
    return { migrated: false };
  } finally {
    store.setConfigLoading(false);
  }
}

/**
 * Initialize multi-repo store for a project
 * Loads configuration and checks all connections
 */
export async function initializeMultiRepoStore(projectId: string): Promise<void> {
  // Load configuration first
  const config = await loadMultiRepoConfig(projectId);

  // If no config exists, try migration
  if (!config || config.repos.length === 0) {
    await migrateToMultiRepo(projectId);
  }

  // Check all connections
  await checkAllRepoConnections(projectId);
}

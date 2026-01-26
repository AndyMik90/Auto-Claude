import { create } from 'zustand';
import type { GitHubSyncStatus } from '../../../shared/types';
import { useMultiRepoStore } from './multi-repo-store';

interface SyncStatusState {
  // Sync status (legacy single-repo)
  syncStatus: GitHubSyncStatus | null;
  connectionError: string | null;

  // Actions
  setSyncStatus: (status: GitHubSyncStatus | null) => void;
  setConnectionError: (error: string | null) => void;
  clearSyncStatus: () => void;

  // Selectors
  isConnected: () => boolean;
  getRepoFullName: () => string | null;
}

export const useSyncStatusStore = create<SyncStatusState>((set, get) => ({
  // Initial state
  syncStatus: null,
  connectionError: null,

  // Actions
  setSyncStatus: (syncStatus) => set({ syncStatus, connectionError: null }),

  setConnectionError: (connectionError) => set({ connectionError }),

  clearSyncStatus: () => set({
    syncStatus: null,
    connectionError: null
  }),

  // Selectors
  isConnected: () => {
    const { syncStatus } = get();
    return syncStatus?.connected ?? false;
  },

  getRepoFullName: () => {
    const { syncStatus } = get();
    return syncStatus?.repoFullName ?? null;
  }
}));

/**
 * Check GitHub connection status (legacy single-repo)
 */
export async function checkGitHubConnection(projectId: string): Promise<GitHubSyncStatus | null> {
  const store = useSyncStatusStore.getState();

  try {
    const result = await window.electronAPI.checkGitHubConnection(projectId);
    if (result.success && result.data) {
      store.setSyncStatus(result.data);
      return result.data;
    } else {
      store.setConnectionError(result.error || 'Failed to check GitHub connection');
      return null;
    }
  } catch (error) {
    store.setConnectionError(error instanceof Error ? error.message : 'Unknown error');
    return null;
  }
}

/**
 * Unified connection check that supports both multi-repo and legacy single-repo
 * Returns true if at least one repository is connected
 */
export async function checkGitHubConnectionUnified(projectId: string): Promise<boolean> {
  const multiRepoStore = useMultiRepoStore.getState();
  const legacyStore = useSyncStatusStore.getState();

  try {
    // First, try multi-repo check
    const multiRepoResult = await window.electronAPI.github.checkAllConnections(projectId);
    if (multiRepoResult.success && multiRepoResult.data) {
      multiRepoStore.setSyncStatus(multiRepoResult.data);

      // If multi-repo has connections, also update legacy store for backward compatibility
      if (multiRepoResult.data.connected && multiRepoResult.data.repos.length > 0) {
        const firstConnected = multiRepoResult.data.repos.find(r => r.connected);
        if (firstConnected) {
          legacyStore.setSyncStatus({
            connected: true,
            repoFullName: firstConnected.repoFullName,
            repoDescription: firstConnected.repoDescription,
            issueCount: multiRepoResult.data.totalIssueCount,
            lastSyncedAt: firstConnected.lastSyncedAt
          });
        }
        return true;
      }
    }

    // Fall back to legacy single-repo check
    const legacyResult = await window.electronAPI.checkGitHubConnection(projectId);
    if (legacyResult.success && legacyResult.data) {
      legacyStore.setSyncStatus(legacyResult.data);
      return legacyResult.data.connected;
    }

    return false;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    legacyStore.setConnectionError(errorMessage);
    multiRepoStore.setSyncStatusError(errorMessage);
    return false;
  }
}

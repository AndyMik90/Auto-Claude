/**
 * Queue Store - Task queueing state management
 *
 * Manages the automatic task queueing feature that allows tasks to be
 * automatically started from Planning to In Progress when slots are available.
 *
 * Queue Configuration:
 * - enabled: Whether auto-start is enabled for the project
 * - maxConcurrent: Maximum number of tasks allowed in In Progress (1-3)
 * - runningCount: Current number of tasks in In Progress
 *
 * The queue automatically starts the next backlog task when a task completes
 * and the running count is below maxConcurrent.
 */

import { create } from 'zustand';
import type { QueueConfig, QueueStatus } from '../../shared/types';
import { debugLog, debugError } from '../../shared/utils/debug-logger';
import { QUEUE_MIN_CONCURRENT, type QueueConcurrent } from '../../shared/constants/task';

interface QueueState {
  /** Map of projectId to queue config */
  configs: Record<string, QueueConfig>;
  /** Current status for each project */
  statuses: Record<string, QueueStatus>;
  /** Pending request tokens for load operations (prevents stale responses) */
  pendingLoadRequests: Record<string, string>;

  // Actions
  setQueueConfig: (projectId: string, config: QueueConfig) => void;
  getQueueConfig: (projectId: string) => QueueConfig | undefined;
  setQueueStatus: (projectId: string, status: QueueStatus) => void;
  getQueueStatus: (projectId: string) => QueueStatus | undefined;
  updateRunningCount: (projectId: string, count: number) => void;
  updateBacklogCount: (projectId: string, count: number) => void;
  clearProject: (projectId: string) => void;
  setPendingLoadRequest: (projectId: string, requestId: string) => void;
}

/**
 * Default queue configuration
 * Uses QueueConcurrent type derived from QUEUE_CONCURRENT_VALUES
 */
export const DEFAULT_QUEUE_CONFIG: QueueConfig = {
  enabled: false,
  maxConcurrent: QUEUE_MIN_CONCURRENT satisfies QueueConcurrent
};

/**
 * Create the queue store
 */
export const useQueueStore = create<QueueState>((set, get) => ({
  configs: {},
  statuses: {},
  pendingLoadRequests: {},

  setQueueConfig: (projectId, config) =>
    set((state) => ({
      configs: {
        ...state.configs,
        [projectId]: config
      }
    })),

  getQueueConfig: (projectId) => {
    return get().configs[projectId];
  },

  setQueueStatus: (projectId, status) =>
    set((state) => ({
      statuses: {
        ...state.statuses,
        [projectId]: status
      }
    })),

  getQueueStatus: (projectId) => {
    return get().statuses[projectId];
  },

  updateRunningCount: (projectId, count) =>
    set((state) => {
      const currentStatus = state.statuses[projectId];
      if (!currentStatus) {
        debugLog('[QueueStore] updateRunningCount called for unknown projectId:', projectId);
        return state;
      }

      return {
        statuses: {
          ...state.statuses,
          [projectId]: {
            ...currentStatus,
            runningCount: count
          }
        }
      };
    }),

  updateBacklogCount: (projectId, count) =>
    set((state) => {
      const currentStatus = state.statuses[projectId];
      if (!currentStatus) {
        debugLog('[QueueStore] updateBacklogCount called for unknown projectId:', projectId);
        return state;
      }

      return {
        statuses: {
          ...state.statuses,
          [projectId]: {
            ...currentStatus,
            backlogCount: count
          }
        }
      };
    }),

  clearProject: (projectId) =>
    set((state) => {
      const newConfigs = { ...state.configs };
      const newStatuses = { ...state.statuses };
      const newPending = { ...state.pendingLoadRequests };
      delete newConfigs[projectId];
      delete newStatuses[projectId];
      delete newPending[projectId];
      return { configs: newConfigs, statuses: newStatuses, pendingLoadRequests: newPending };
    }),

  setPendingLoadRequest: (projectId, requestId) =>
    set((state) => ({
      pendingLoadRequests: {
        ...state.pendingLoadRequests,
        [projectId]: requestId
      }
    }))
}));

/**
 * Load queue configuration for a project
 * Uses request token to prevent stale responses from racing requests
 */
export async function loadQueueConfig(projectId: string): Promise<QueueConfig | null> {
  // Generate unique request ID for this load operation
  const requestId = `load-${projectId}-${Date.now()}-${Math.random()}`;
  const store = useQueueStore.getState();

  // Register this as the pending request
  store.setPendingLoadRequest(projectId, requestId);

  try {
    const result = await window.electronAPI.getQueueConfig(projectId);
    if (result.success && result.data) {
      // Only apply if this is still the latest request
      const currentState = useQueueStore.getState();
      if (currentState.pendingLoadRequests[projectId] === requestId) {
        currentState.setQueueConfig(projectId, result.data);
        return result.data;
      } else {
        debugLog('[QueueStore] Ignoring stale loadQueueConfig response for:', projectId);
        return currentState.getQueueConfig(projectId) || null;
      }
    }
    return null;
  } catch (error) {
    debugError('[QueueStore] Failed to load queue config:', error);
    return null;
  }
}

/**
 * Helper to rollback optimistic config update when no previous config exists.
 * Clears the projectId entry from the configs map.
 */
function rollbackOptimisticConfig(projectId: string): void {
  const currentState = useQueueStore.getState();
  const newConfigs = { ...currentState.configs };
  delete newConfigs[projectId];
  useQueueStore.setState({ configs: newConfigs });
}

/**
 * Save queue configuration for a project
 * Uses optimistic update with rollback on failure
 */
export async function saveQueueConfig(projectId: string, config: QueueConfig): Promise<boolean> {
  const store = useQueueStore.getState();

  // Save previous config for rollback
  const previousConfig = store.getQueueConfig(projectId);

  // Optimistic update: apply to renderer state immediately
  store.setQueueConfig(projectId, config);

  try {
    const result = await window.electronAPI.setQueueConfig(projectId, config);
    if (result.success) {
      return true;
    } else {
      // IPC failed - rollback renderer state
      if (previousConfig) {
        store.setQueueConfig(projectId, previousConfig);
      } else {
        rollbackOptimisticConfig(projectId);
      }
      debugError('[QueueStore] Failed to save queue config, rolled back renderer state');
      return false;
    }
  } catch (error) {
    // Exception occurred - rollback renderer state
    if (previousConfig) {
      store.setQueueConfig(projectId, previousConfig);
    } else {
      rollbackOptimisticConfig(projectId);
    }
    debugError('[QueueStore] Failed to save queue config:', error);
    return false;
  }
}

/**
 * Fetch current queue status for a project via IPC
 */
export async function fetchQueueStatus(projectId: string): Promise<QueueStatus | null> {
  try {
    const result = await window.electronAPI.getQueueStatus(projectId);
    if (result.success && result.data) {
      const store = useQueueStore.getState();
      store.setQueueStatus(projectId, result.data);
      return result.data;
    }
    return null;
  } catch (error) {
    debugError('[QueueStore] Failed to get queue status:', error);
    return null;
  }
}

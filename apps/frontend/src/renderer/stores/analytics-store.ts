import { create } from 'zustand';
import type {
  DateFilter,
  FeatureType,
  AnalyticsSummary,
  DrillDownState,
  DrillDownLevel,
  AnalyticsLoadingState,
  AnalyticsPhase
} from '../../shared/types';

// ============================================
// Store State Interface
// ============================================

interface AnalyticsStoreState {
  // Data
  summary: AnalyticsSummary | null;

  // Filters
  dateFilter: DateFilter;
  activeFeature: FeatureType | 'overview';

  // Drill-down navigation
  drillDown: DrillDownState;

  // Loading state
  loadingState: AnalyticsLoadingState;
  error: string | null;

  // Cache management
  lastFetched: Date | null;
  currentProjectId: string | null;

  // Actions - Data
  setSummary: (summary: AnalyticsSummary | null) => void;
  clearSummary: () => void;

  // Actions - Filters
  setDateFilter: (filter: DateFilter) => void;
  setActiveFeature: (feature: FeatureType | 'overview') => void;

  // Actions - Drill-down
  setDrillDown: (drillDown: DrillDownState) => void;
  drillDownToFeature: (feature: FeatureType) => void;
  drillDownToTask: (taskId: string) => void;
  drillDownToPhase: (phase: AnalyticsPhase) => void;
  drillUp: () => void;
  resetDrillDown: () => void;

  // Actions - Loading state
  setLoadingState: (state: AnalyticsLoadingState) => void;
  setError: (error: string | null) => void;

  // Actions - Cache
  setLastFetched: (date: Date | null) => void;
  setCurrentProjectId: (projectId: string | null) => void;
  invalidateCache: () => void;

  // Selectors
  isLoading: () => boolean;
  hasData: () => boolean;
  shouldRefetch: (projectId: string) => boolean;
}

// ============================================
// Initial State
// ============================================

const initialDrillDown: DrillDownState = {
  level: 'overview'
};

// ============================================
// Store Implementation
// ============================================

export const useAnalyticsStore = create<AnalyticsStoreState>((set, get) => ({
  // Initial state - Data
  summary: null,

  // Initial state - Filters
  dateFilter: 'last_7_days',
  activeFeature: 'overview',

  // Initial state - Drill-down
  drillDown: initialDrillDown,

  // Initial state - Loading
  loadingState: 'idle',
  error: null,

  // Initial state - Cache
  lastFetched: null,
  currentProjectId: null,

  // Actions - Data
  setSummary: (summary) => set({ summary }),

  clearSummary: () =>
    set({
      summary: null,
      lastFetched: null,
      drillDown: initialDrillDown
    }),

  // Actions - Filters
  setDateFilter: (dateFilter) =>
    set({
      dateFilter,
      // Reset drill-down when changing date filter
      drillDown: initialDrillDown,
      // Invalidate cache to force refetch with new filter
      lastFetched: null
    }),

  setActiveFeature: (activeFeature) =>
    set({
      activeFeature,
      // Update drill-down level based on feature selection
      drillDown:
        activeFeature === 'overview'
          ? initialDrillDown
          : { level: 'feature', feature: activeFeature as FeatureType }
    }),

  // Actions - Drill-down
  setDrillDown: (drillDown) => set({ drillDown }),

  drillDownToFeature: (feature) =>
    set({
      drillDown: { level: 'feature', feature },
      activeFeature: feature
    }),

  drillDownToTask: (taskId) =>
    set((state) => ({
      drillDown: {
        level: 'task',
        feature: state.drillDown.feature,
        taskId
      }
    })),

  drillDownToPhase: (phase) =>
    set((state) => ({
      drillDown: {
        level: 'phase',
        feature: state.drillDown.feature,
        taskId: state.drillDown.taskId,
        phase
      }
    })),

  drillUp: () =>
    set((state) => {
      const { drillDown } = state;

      // Navigate up one level in the drill-down hierarchy
      switch (drillDown.level) {
        case 'phase':
          return {
            drillDown: {
              level: 'task',
              feature: drillDown.feature,
              taskId: drillDown.taskId
            }
          };
        case 'task':
          return {
            drillDown: {
              level: 'feature',
              feature: drillDown.feature
            }
          };
        case 'feature':
          return {
            drillDown: initialDrillDown,
            activeFeature: 'overview'
          };
        default:
          return state;
      }
    }),

  resetDrillDown: () =>
    set({
      drillDown: initialDrillDown,
      activeFeature: 'overview'
    }),

  // Actions - Loading state
  setLoadingState: (loadingState) => set({ loadingState }),

  setError: (error) =>
    set({
      error,
      loadingState: error ? 'error' : get().loadingState
    }),

  // Actions - Cache
  setLastFetched: (lastFetched) => set({ lastFetched }),

  setCurrentProjectId: (currentProjectId) => set({ currentProjectId }),

  invalidateCache: () => set({ lastFetched: null }),

  // Selectors
  isLoading: () => get().loadingState === 'loading',

  hasData: () => get().summary !== null,

  shouldRefetch: (projectId) => {
    const state = get();

    // Always refetch if project changed
    if (state.currentProjectId !== projectId) {
      return true;
    }

    // Refetch if cache is empty
    if (!state.lastFetched) {
      return true;
    }

    // Refetch if cache is older than 5 minutes
    const cacheAge = Date.now() - state.lastFetched.getTime();
    const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
    if (cacheAge > CACHE_TTL_MS) {
      return true;
    }

    return false;
  }
}));

// ============================================
// Async Helper Functions
// ============================================

/**
 * Load analytics data for a project
 * @param projectId - The project ID to load analytics for
 * @param options - Optional parameters
 * @param options.forceRefresh - If true, bypasses cache and forces a fresh load
 */
export async function loadAnalytics(
  projectId: string,
  options?: { forceRefresh?: boolean }
): Promise<void> {
  const store = useAnalyticsStore.getState();

  // Check if we need to refetch
  if (!options?.forceRefresh && !store.shouldRefetch(projectId)) {
    return;
  }

  // Set loading state
  store.setLoadingState('loading');
  store.setError(null);
  store.setCurrentProjectId(projectId);

  try {
    const dateFilter = store.dateFilter;
    const result = await window.electronAPI.getAnalytics(projectId, dateFilter);

    if (result.success && result.data) {
      store.setSummary(result.data);
      store.setLastFetched(new Date());
      store.setLoadingState('loaded');
    } else {
      store.setError(result.error || 'Failed to load analytics');
      store.setLoadingState('error');
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error loading analytics';
    store.setError(errorMessage);
    store.setLoadingState('error');
  }
}

/**
 * Refresh analytics data for the current project
 * Forces a fresh load bypassing the cache
 */
export async function refreshAnalytics(): Promise<void> {
  const store = useAnalyticsStore.getState();
  const projectId = store.currentProjectId;

  if (!projectId) {
    store.setError('No project selected');
    return;
  }

  await loadAnalytics(projectId, { forceRefresh: true });
}

/**
 * Change the date filter and reload analytics
 * @param projectId - The project ID
 * @param dateFilter - The new date filter
 */
export async function changeAndLoadDateFilter(
  projectId: string,
  dateFilter: DateFilter
): Promise<void> {
  const store = useAnalyticsStore.getState();

  // Update the filter first (this invalidates cache)
  store.setDateFilter(dateFilter);

  // Then load analytics with the new filter
  await loadAnalytics(projectId, { forceRefresh: true });
}

/**
 * Clear all analytics state
 * Useful when switching projects or logging out
 */
export function clearAnalytics(): void {
  const store = useAnalyticsStore.getState();
  store.clearSummary();
  store.setLoadingState('idle');
  store.setError(null);
  store.setCurrentProjectId(null);
  store.resetDrillDown();
}

// ============================================
// Computed Selectors (for derived data)
// ============================================

/**
 * Get the current feature's metrics from the summary
 */
export function getCurrentFeatureMetrics() {
  const store = useAnalyticsStore.getState();
  const { summary, activeFeature } = store;

  if (!summary || activeFeature === 'overview') {
    return null;
  }

  return summary.byFeature[activeFeature] || null;
}

/**
 * Get tasks filtered by the current active feature
 */
export function getFilteredTasks() {
  const store = useAnalyticsStore.getState();
  const { summary, activeFeature } = store;

  if (!summary) {
    return [];
  }

  if (activeFeature === 'overview') {
    return summary.tasks;
  }

  return summary.tasks.filter((task) => task.feature === activeFeature);
}

/**
 * Get a specific task by ID from the summary
 */
export function getTaskById(taskId: string) {
  const store = useAnalyticsStore.getState();
  const { summary } = store;

  if (!summary) {
    return null;
  }

  return summary.tasks.find((task) => task.taskId === taskId) || null;
}

/**
 * Get the current drill-down breadcrumb path
 */
export function getDrillDownPath(): string[] {
  const store = useAnalyticsStore.getState();
  const { drillDown, summary } = store;

  const path: string[] = ['Overview'];

  if (drillDown.level === 'overview') {
    return path;
  }

  if (drillDown.feature) {
    path.push(drillDown.feature);
  }

  if (drillDown.level === 'task' || drillDown.level === 'phase') {
    if (drillDown.taskId && summary) {
      const task = summary.tasks.find((t) => t.taskId === drillDown.taskId);
      path.push(task?.title || drillDown.taskId);
    }
  }

  if (drillDown.level === 'phase' && drillDown.phase) {
    path.push(drillDown.phase);
  }

  return path;
}

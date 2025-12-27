/**
 * Roadmap Store
 * Zustand store for managing project roadmap features and milestones
 * Uses persist middleware with AsyncStorage for data persistence
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { RoadmapFeature } from '../types';

/**
 * Generates a unique ID for new features
 */
const generateId = (): string => {
  return `feature-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
};

/**
 * Get current timestamp in ISO format
 */
const now = (): string => new Date().toISOString();

/**
 * Mock roadmap features for the default project
 */
const mockFeatures: RoadmapFeature[] = [
  {
    id: 'feature-001',
    title: 'Kanban Board with Drag-and-Drop',
    description: 'Implement a full Kanban board with 5 columns and drag-and-drop task movement between columns.',
    status: 'completed',
    priority: 'high',
    progress: 100,
    targetDate: '2025-01-20T00:00:00Z',
    completedDate: '2025-01-18T14:30:00Z',
    linkedTaskIds: ['task-009', 'task-011'],
  },
  {
    id: 'feature-002',
    title: 'AI Chat Integration',
    description: 'Multi-session AI chat interface with streaming responses and tool visualization.',
    status: 'completed',
    priority: 'high',
    progress: 100,
    targetDate: '2025-01-25T00:00:00Z',
    completedDate: '2025-01-23T16:00:00Z',
    linkedTaskIds: ['task-005'],
  },
  {
    id: 'feature-003',
    title: 'Real-time WebSocket Updates',
    description: 'Implement WebSocket connection for live task status updates and terminal output streaming.',
    status: 'in_progress',
    priority: 'high',
    progress: 65,
    targetDate: '2025-02-01T00:00:00Z',
    linkedTaskIds: ['task-004'],
  },
  {
    id: 'feature-004',
    title: 'Push Notifications',
    description: 'Configure push notifications for task completion, errors, and important events.',
    status: 'in_progress',
    priority: 'medium',
    progress: 40,
    targetDate: '2025-02-05T00:00:00Z',
    linkedTaskIds: [],
  },
  {
    id: 'feature-005',
    title: 'GitHub Integration',
    description: 'Display GitHub issues and PRs with investigate and auto-fix action buttons.',
    status: 'completed',
    priority: 'high',
    progress: 100,
    targetDate: '2025-01-28T00:00:00Z',
    completedDate: '2025-01-27T11:00:00Z',
    linkedTaskIds: [],
  },
  {
    id: 'feature-006',
    title: 'Project Context Browser',
    description: 'File tree navigation and memory search for exploring project context.',
    status: 'in_progress',
    priority: 'medium',
    progress: 25,
    targetDate: '2025-02-10T00:00:00Z',
    linkedTaskIds: [],
  },
  {
    id: 'feature-007',
    title: 'Terminal Viewer',
    description: 'Read-only terminal viewer with real-time output streaming and session management.',
    status: 'planned',
    priority: 'medium',
    progress: 0,
    targetDate: '2025-02-15T00:00:00Z',
    linkedTaskIds: [],
  },
  {
    id: 'feature-008',
    title: 'Onboarding Wizard',
    description: 'First-time setup wizard with QR code scanning, server discovery, and API key configuration.',
    status: 'planned',
    priority: 'low',
    progress: 0,
    targetDate: '2025-02-20T00:00:00Z',
    linkedTaskIds: [],
  },
  {
    id: 'feature-009',
    title: 'Offline Mode Support',
    description: 'Cache data locally for offline access and sync when connection is restored.',
    status: 'planned',
    priority: 'low',
    progress: 0,
    targetDate: '2025-03-01T00:00:00Z',
    linkedTaskIds: [],
  },
  {
    id: 'feature-010',
    title: 'Biometric Authentication',
    description: 'Support Face ID, Touch ID, and fingerprint authentication for secure access.',
    status: 'planned',
    priority: 'medium',
    progress: 0,
    targetDate: '2025-02-25T00:00:00Z',
    linkedTaskIds: [],
  },
];

/**
 * Feature status type for filtering
 */
export type FeatureStatus = RoadmapFeature['status'];

/**
 * Feature filter options
 */
export interface FeatureFilters {
  status?: FeatureStatus[];
  priority?: RoadmapFeature['priority'][];
  search?: string;
}

/**
 * Roadmap Store State Interface
 */
interface RoadmapState {
  /** All roadmap features */
  features: RoadmapFeature[];

  /** Currently selected feature ID */
  selectedFeatureId: string | null;

  /** Active filters */
  filters: FeatureFilters;

  /** Current project ID for filtering features */
  projectId: string | null;

  /** Loading state */
  isLoading: boolean;

  /** Error message */
  error: string | null;
}

/**
 * Roadmap Store Actions Interface
 */
interface RoadmapActions {
  /** Add a new feature */
  addFeature: (feature: Omit<RoadmapFeature, 'id'>) => RoadmapFeature;

  /** Update an existing feature */
  updateFeature: (id: string, updates: Partial<RoadmapFeature>) => void;

  /** Delete a feature */
  deleteFeature: (id: string) => void;

  /** Select a feature */
  selectFeature: (id: string | null) => void;

  /** Get a feature by ID */
  getFeatureById: (id: string) => RoadmapFeature | undefined;

  /** Update feature progress */
  updateProgress: (id: string, progress: number) => void;

  /** Mark feature as complete */
  completeFeature: (id: string) => void;

  /** Link a task to a feature */
  linkTask: (featureId: string, taskId: string) => void;

  /** Unlink a task from a feature */
  unlinkTask: (featureId: string, taskId: string) => void;

  /** Set filters */
  setFilters: (filters: FeatureFilters) => void;

  /** Clear filters */
  clearFilters: () => void;

  /** Get filtered features */
  getFilteredFeatures: () => RoadmapFeature[];

  /** Get features by status */
  getFeaturesByStatus: () => Record<FeatureStatus, RoadmapFeature[]>;

  /** Set project ID */
  setProjectId: (projectId: string | null) => void;

  /** Set loading state */
  setLoading: (loading: boolean) => void;

  /** Set error message */
  setError: (error: string | null) => void;

  /** Reset store to initial state */
  resetStore: () => void;
}

/**
 * Combined Roadmap Store Type
 */
type RoadmapStore = RoadmapState & RoadmapActions;

/**
 * Initial state for the store
 */
const initialState: RoadmapState = {
  features: mockFeatures,
  selectedFeatureId: null,
  filters: {},
  projectId: 'project-001',
  isLoading: false,
  error: null,
};

/**
 * Roadmap Store
 * Zustand store with persist middleware for AsyncStorage persistence
 */
export const useRoadmapStore = create<RoadmapStore>()(
  persist(
    (set, get) => ({
      // Initial state
      ...initialState,

      // Actions
      addFeature: (feature: Omit<RoadmapFeature, 'id'>): RoadmapFeature => {
        const newFeature: RoadmapFeature = {
          ...feature,
          id: generateId(),
        };

        set((state) => ({
          features: [...state.features, newFeature],
        }));

        return newFeature;
      },

      updateFeature: (id: string, updates: Partial<RoadmapFeature>): void => {
        set((state) => ({
          features: state.features.map((feature) =>
            feature.id === id ? { ...feature, ...updates } : feature
          ),
        }));
      },

      deleteFeature: (id: string): void => {
        set((state) => ({
          features: state.features.filter((feature) => feature.id !== id),
          selectedFeatureId:
            state.selectedFeatureId === id ? null : state.selectedFeatureId,
        }));
      },

      selectFeature: (id: string | null): void => {
        set({ selectedFeatureId: id });
      },

      getFeatureById: (id: string): RoadmapFeature | undefined => {
        return get().features.find((feature) => feature.id === id);
      },

      updateProgress: (id: string, progress: number): void => {
        const clampedProgress = Math.max(0, Math.min(100, progress));
        const status: FeatureStatus =
          clampedProgress === 100
            ? 'completed'
            : clampedProgress > 0
            ? 'in_progress'
            : 'planned';

        set((state) => ({
          features: state.features.map((feature) =>
            feature.id === id
              ? {
                  ...feature,
                  progress: clampedProgress,
                  status,
                  completedDate:
                    clampedProgress === 100 ? now() : feature.completedDate,
                }
              : feature
          ),
        }));
      },

      completeFeature: (id: string): void => {
        set((state) => ({
          features: state.features.map((feature) =>
            feature.id === id
              ? {
                  ...feature,
                  status: 'completed' as const,
                  progress: 100,
                  completedDate: now(),
                }
              : feature
          ),
        }));
      },

      linkTask: (featureId: string, taskId: string): void => {
        set((state) => ({
          features: state.features.map((feature) =>
            feature.id === featureId
              ? {
                  ...feature,
                  linkedTaskIds: [
                    ...(feature.linkedTaskIds || []).filter((id) => id !== taskId),
                    taskId,
                  ],
                }
              : feature
          ),
        }));
      },

      unlinkTask: (featureId: string, taskId: string): void => {
        set((state) => ({
          features: state.features.map((feature) =>
            feature.id === featureId
              ? {
                  ...feature,
                  linkedTaskIds: (feature.linkedTaskIds || []).filter(
                    (id) => id !== taskId
                  ),
                }
              : feature
          ),
        }));
      },

      setFilters: (filters: FeatureFilters): void => {
        set({ filters });
      },

      clearFilters: (): void => {
        set({ filters: {} });
      },

      getFilteredFeatures: (): RoadmapFeature[] => {
        const { features, filters } = get();

        return features.filter((feature) => {
          // Status filter
          if (filters.status && filters.status.length > 0) {
            if (!filters.status.includes(feature.status)) return false;
          }

          // Priority filter
          if (filters.priority && filters.priority.length > 0) {
            if (!filters.priority.includes(feature.priority)) return false;
          }

          // Search filter
          if (filters.search) {
            const searchLower = filters.search.toLowerCase();
            const matchesTitle = feature.title.toLowerCase().includes(searchLower);
            const matchesDescription = feature.description
              .toLowerCase()
              .includes(searchLower);
            if (!matchesTitle && !matchesDescription) {
              return false;
            }
          }

          return true;
        });
      },

      getFeaturesByStatus: (): Record<FeatureStatus, RoadmapFeature[]> => {
        const features = get().features;
        return {
          planned: features.filter((f) => f.status === 'planned'),
          in_progress: features.filter((f) => f.status === 'in_progress'),
          completed: features.filter((f) => f.status === 'completed'),
          cancelled: features.filter((f) => f.status === 'cancelled'),
        };
      },

      setProjectId: (projectId: string | null): void => {
        set({ projectId });
      },

      setLoading: (loading: boolean): void => {
        set({ isLoading: loading });
      },

      setError: (error: string | null): void => {
        set({ error });
      },

      resetStore: (): void => {
        set(initialState);
      },
    }),
    {
      name: 'autoclaude-roadmap-storage',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        features: state.features,
        projectId: state.projectId,
      }),
    }
  )
);

/**
 * Selector hooks for common use cases
 */

/** Get the currently selected feature */
export const useSelectedFeature = (): RoadmapFeature | undefined => {
  const { features, selectedFeatureId } = useRoadmapStore();
  return features.find((feature) => feature.id === selectedFeatureId);
};

/** Get feature count by status */
export const useFeatureCounts = (): Record<FeatureStatus, number> => {
  const features = useRoadmapStore((state) => state.features);
  return {
    planned: features.filter((f) => f.status === 'planned').length,
    in_progress: features.filter((f) => f.status === 'in_progress').length,
    completed: features.filter((f) => f.status === 'completed').length,
    cancelled: features.filter((f) => f.status === 'cancelled').length,
  };
};

/** Get total feature count */
export const useTotalFeatureCount = (): number => {
  return useRoadmapStore((state) => state.features.length);
};

/** Get overall roadmap progress (percentage of completed features) */
export const useRoadmapProgress = (): number => {
  const features = useRoadmapStore((state) => state.features);
  if (features.length === 0) return 0;
  const completed = features.filter((f) => f.status === 'completed').length;
  return Math.round((completed / features.length) * 100);
};

/** Get in-progress features */
export const useInProgressFeatures = (): RoadmapFeature[] => {
  const features = useRoadmapStore((state) => state.features);
  return features.filter((f) => f.status === 'in_progress');
};

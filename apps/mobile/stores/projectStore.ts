/**
 * Project Store
 * Zustand store for project management with recent projects tracking
 * Uses persist middleware with AsyncStorage for data persistence
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type {
  Project,
  ProjectStatus,
  ProjectCreateInput,
  ProjectUpdateInput,
  ProjectFilters,
  ProjectStats,
  RecentProject,
} from '../types';

/**
 * Maximum number of recent projects to track
 */
const MAX_RECENT_PROJECTS = 5;

/**
 * Generates a unique ID for new projects
 */
const generateId = (): string => {
  return `project-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
};

/**
 * Get current timestamp in ISO format
 */
const now = (): string => new Date().toISOString();

/**
 * Mock projects data - 6 projects with various statuses and metadata
 */
const mockProjects: Project[] = [
  {
    id: 'project-001',
    name: 'AutoClaude Mobile',
    description: 'Cross-platform mobile companion app for AutoClaude desktop application. Built with Expo and React Native.',
    status: 'active',
    path: '/Users/dev/projects/autoclaude-mobile',
    repositoryUrl: 'https://github.com/autoclaude/mobile-app',
    stats: {
      totalTasks: 24,
      completedTasks: 8,
      inProgressTasks: 5,
      backlogTasks: 7,
      aiReviewTasks: 2,
      humanReviewTasks: 2,
    },
    createdAt: '2025-01-01T10:00:00Z',
    updatedAt: '2025-01-16T14:30:00Z',
    lastOpenedAt: '2025-01-16T14:30:00Z',
    settings: {
      claudeProfileId: 'profile-default',
      autoReviewEnabled: true,
      notificationsEnabled: true,
      branchPrefix: 'feature/',
    },
  },
  {
    id: 'project-002',
    name: 'API Gateway Service',
    description: 'Backend API gateway for microservices architecture. Handles authentication, rate limiting, and request routing.',
    status: 'active',
    path: '/Users/dev/projects/api-gateway',
    repositoryUrl: 'https://github.com/company/api-gateway',
    stats: {
      totalTasks: 18,
      completedTasks: 12,
      inProgressTasks: 3,
      backlogTasks: 2,
      aiReviewTasks: 1,
      humanReviewTasks: 0,
    },
    createdAt: '2024-11-15T09:00:00Z',
    updatedAt: '2025-01-15T11:20:00Z',
    lastOpenedAt: '2025-01-15T11:20:00Z',
    settings: {
      autoReviewEnabled: true,
      notificationsEnabled: true,
    },
  },
  {
    id: 'project-003',
    name: 'Design System Library',
    description: 'Shared component library with React components, tokens, and documentation. Used across all frontend applications.',
    status: 'active',
    path: '/Users/dev/projects/design-system',
    repositoryUrl: 'https://github.com/company/design-system',
    stats: {
      totalTasks: 32,
      completedTasks: 28,
      inProgressTasks: 2,
      backlogTasks: 1,
      aiReviewTasks: 1,
      humanReviewTasks: 0,
    },
    createdAt: '2024-08-20T14:00:00Z',
    updatedAt: '2025-01-14T16:45:00Z',
    lastOpenedAt: '2025-01-14T16:45:00Z',
    settings: {
      autoReviewEnabled: false,
      notificationsEnabled: true,
    },
  },
  {
    id: 'project-004',
    name: 'Data Pipeline Service',
    description: 'ETL pipeline for processing and transforming large datasets. Integrates with multiple data sources and warehouses.',
    status: 'paused',
    path: '/Users/dev/projects/data-pipeline',
    repositoryUrl: 'https://github.com/company/data-pipeline',
    stats: {
      totalTasks: 15,
      completedTasks: 10,
      inProgressTasks: 0,
      backlogTasks: 5,
      aiReviewTasks: 0,
      humanReviewTasks: 0,
    },
    createdAt: '2024-06-10T08:00:00Z',
    updatedAt: '2024-12-20T10:00:00Z',
    lastOpenedAt: '2024-12-20T10:00:00Z',
    settings: {
      autoReviewEnabled: true,
      notificationsEnabled: false,
    },
  },
  {
    id: 'project-005',
    name: 'Customer Dashboard',
    description: 'Customer-facing dashboard with analytics, account management, and self-service features. Built with Next.js.',
    status: 'completed',
    path: '/Users/dev/projects/customer-dashboard',
    repositoryUrl: 'https://github.com/company/customer-dashboard',
    stats: {
      totalTasks: 45,
      completedTasks: 45,
      inProgressTasks: 0,
      backlogTasks: 0,
      aiReviewTasks: 0,
      humanReviewTasks: 0,
    },
    createdAt: '2024-03-01T11:00:00Z',
    updatedAt: '2024-09-15T14:00:00Z',
    lastOpenedAt: '2024-09-15T14:00:00Z',
    settings: {
      autoReviewEnabled: true,
      notificationsEnabled: true,
    },
  },
  {
    id: 'project-006',
    name: 'Internal Tools Hub',
    description: 'Collection of internal productivity tools and utilities for engineering team. Includes deployment helpers and monitoring dashboards.',
    status: 'active',
    path: '/Users/dev/projects/internal-tools',
    repositoryUrl: 'https://github.com/company/internal-tools',
    stats: {
      totalTasks: 12,
      completedTasks: 6,
      inProgressTasks: 2,
      backlogTasks: 3,
      aiReviewTasks: 0,
      humanReviewTasks: 1,
    },
    createdAt: '2024-10-05T13:00:00Z',
    updatedAt: '2025-01-12T09:30:00Z',
    lastOpenedAt: '2025-01-12T09:30:00Z',
    settings: {
      autoReviewEnabled: false,
      notificationsEnabled: true,
      branchPrefix: 'tools/',
    },
  },
];

/**
 * Default recent projects based on lastOpenedAt
 */
const defaultRecentProjects: RecentProject[] = mockProjects
  .filter((p) => p.lastOpenedAt)
  .sort((a, b) =>
    new Date(b.lastOpenedAt!).getTime() - new Date(a.lastOpenedAt!).getTime()
  )
  .slice(0, MAX_RECENT_PROJECTS)
  .map((p) => ({
    id: p.id,
    name: p.name,
    lastOpenedAt: p.lastOpenedAt!,
  }));

/**
 * Project Store State Interface
 */
interface ProjectState {
  /** All projects in the store */
  projects: Project[];

  /** Currently selected project ID */
  currentProjectId: string | null;

  /** Recently opened projects (max 5) */
  recentProjects: RecentProject[];

  /** Active filters applied to the project list */
  filters: ProjectFilters;

  /** Loading state for async operations */
  isLoading: boolean;

  /** Error message if any */
  error: string | null;
}

/**
 * Project Store Actions Interface
 */
interface ProjectActions {
  /** Add a new project to the store */
  addProject: (input: ProjectCreateInput) => Project;

  /** Update an existing project */
  updateProject: (id: string, updates: ProjectUpdateInput) => void;

  /** Delete a project from the store */
  deleteProject: (id: string) => void;

  /** Select a project as the current active project */
  selectProject: (id: string) => void;

  /** Clear the current project selection */
  clearSelection: () => void;

  /** Get a project by ID */
  getProjectById: (id: string) => Project | undefined;

  /** Get the current active project */
  getCurrentProject: () => Project | undefined;

  /** Update recent projects list when opening a project */
  addToRecent: (id: string) => void;

  /** Remove a project from recent list */
  removeFromRecent: (id: string) => void;

  /** Update project stats */
  updateStats: (id: string, stats: Partial<ProjectStats>) => void;

  /** Set filters */
  setFilters: (filters: ProjectFilters) => void;

  /** Clear all filters */
  clearFilters: () => void;

  /** Get filtered projects */
  getFilteredProjects: () => Project[];

  /** Get projects by status */
  getProjectsByStatus: (status: ProjectStatus) => Project[];

  /** Set loading state */
  setLoading: (loading: boolean) => void;

  /** Set error message */
  setError: (error: string | null) => void;

  /** Reset store to initial state (with mock data) */
  resetStore: () => void;
}

/**
 * Combined Project Store Type
 */
type ProjectStore = ProjectState & ProjectActions;

/**
 * Initial state for the store
 */
const initialState: ProjectState = {
  projects: mockProjects,
  currentProjectId: 'project-001', // Default to first project
  recentProjects: defaultRecentProjects,
  filters: {},
  isLoading: false,
  error: null,
};

/**
 * Project Store
 * Zustand store with persist middleware for AsyncStorage persistence
 */
export const useProjectStore = create<ProjectStore>()(
  persist(
    (set, get) => ({
      // Initial state
      ...initialState,

      // Actions
      addProject: (input: ProjectCreateInput): Project => {
        const newProject: Project = {
          id: generateId(),
          name: input.name,
          description: input.description,
          status: 'active',
          path: input.path,
          repositoryUrl: input.repositoryUrl,
          stats: {
            totalTasks: 0,
            completedTasks: 0,
            inProgressTasks: 0,
            backlogTasks: 0,
            aiReviewTasks: 0,
            humanReviewTasks: 0,
          },
          createdAt: now(),
          updatedAt: now(),
          lastOpenedAt: now(),
          settings: {
            autoReviewEnabled: true,
            notificationsEnabled: true,
          },
        };

        set((state) => ({
          projects: [...state.projects, newProject],
        }));

        // Add to recent projects
        get().addToRecent(newProject.id);

        return newProject;
      },

      updateProject: (id: string, updates: ProjectUpdateInput): void => {
        set((state) => ({
          projects: state.projects.map((project) =>
            project.id === id
              ? {
                  ...project,
                  ...updates,
                  updatedAt: now(),
                  // Merge settings if provided
                  settings: updates.settings
                    ? { ...project.settings, ...updates.settings }
                    : project.settings,
                }
              : project
          ),
          // Update recent projects if name changed
          recentProjects: updates.name
            ? state.recentProjects.map((rp) =>
                rp.id === id ? { ...rp, name: updates.name! } : rp
              )
            : state.recentProjects,
        }));
      },

      deleteProject: (id: string): void => {
        set((state) => ({
          projects: state.projects.filter((project) => project.id !== id),
          // Clear selection if deleted project was selected
          currentProjectId:
            state.currentProjectId === id ? null : state.currentProjectId,
          // Remove from recent
          recentProjects: state.recentProjects.filter((rp) => rp.id !== id),
        }));
      },

      selectProject: (id: string): void => {
        const project = get().getProjectById(id);
        if (!project) return;

        // Update lastOpenedAt
        set((state) => ({
          currentProjectId: id,
          projects: state.projects.map((p) =>
            p.id === id ? { ...p, lastOpenedAt: now() } : p
          ),
        }));

        // Add to recent projects
        get().addToRecent(id);
      },

      clearSelection: (): void => {
        set({ currentProjectId: null });
      },

      getProjectById: (id: string): Project | undefined => {
        return get().projects.find((project) => project.id === id);
      },

      getCurrentProject: (): Project | undefined => {
        const { projects, currentProjectId } = get();
        if (!currentProjectId) return undefined;
        return projects.find((project) => project.id === currentProjectId);
      },

      addToRecent: (id: string): void => {
        const project = get().getProjectById(id);
        if (!project) return;

        set((state) => {
          // Remove if already exists
          const filtered = state.recentProjects.filter((rp) => rp.id !== id);

          // Add to front
          const newRecent: RecentProject = {
            id: project.id,
            name: project.name,
            lastOpenedAt: now(),
          };

          // Keep only max items
          const updated = [newRecent, ...filtered].slice(0, MAX_RECENT_PROJECTS);

          return { recentProjects: updated };
        });
      },

      removeFromRecent: (id: string): void => {
        set((state) => ({
          recentProjects: state.recentProjects.filter((rp) => rp.id !== id),
        }));
      },

      updateStats: (id: string, stats: Partial<ProjectStats>): void => {
        set((state) => ({
          projects: state.projects.map((project) =>
            project.id === id
              ? {
                  ...project,
                  stats: { ...project.stats, ...stats } as ProjectStats,
                  updatedAt: now(),
                }
              : project
          ),
        }));
      },

      setFilters: (filters: ProjectFilters): void => {
        set({ filters });
      },

      clearFilters: (): void => {
        set({ filters: {} });
      },

      getFilteredProjects: (): Project[] => {
        const { projects, filters } = get();

        return projects.filter((project) => {
          // Status filter
          if (filters.status && filters.status.length > 0) {
            if (!filters.status.includes(project.status)) return false;
          }

          // Search filter
          if (filters.search) {
            const searchLower = filters.search.toLowerCase();
            const matchesName = project.name.toLowerCase().includes(searchLower);
            const matchesDescription = project.description
              .toLowerCase()
              .includes(searchLower);
            if (!matchesName && !matchesDescription) {
              return false;
            }
          }

          return true;
        });
      },

      getProjectsByStatus: (status: ProjectStatus): Project[] => {
        return get().projects.filter((project) => project.status === status);
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
      name: 'autoclaude-project-storage',
      storage: createJSONStorage(() => AsyncStorage),
      // Persist projects and recent list, not UI state
      partialize: (state) => ({
        projects: state.projects,
        currentProjectId: state.currentProjectId,
        recentProjects: state.recentProjects,
      }),
    }
  )
);

/**
 * Selector hooks for common use cases
 */

/** Get the current active project */
export const useCurrentProject = (): Project | undefined => {
  const { projects, currentProjectId } = useProjectStore();
  return projects.find((project) => project.id === currentProjectId);
};

/** Get recent projects list */
export const useRecentProjects = (): RecentProject[] => {
  return useProjectStore((state) => state.recentProjects);
};

/** Get project count by status */
export const useProjectCounts = (): Record<ProjectStatus, number> => {
  const projects = useProjectStore((state) => state.projects);
  return {
    active: projects.filter((p) => p.status === 'active').length,
    paused: projects.filter((p) => p.status === 'paused').length,
    completed: projects.filter((p) => p.status === 'completed').length,
    archived: projects.filter((p) => p.status === 'archived').length,
  };
};

/** Get total project count */
export const useTotalProjectCount = (): number => {
  return useProjectStore((state) => state.projects.length);
};

/** Get active projects (not paused, completed, or archived) */
export const useActiveProjects = (): Project[] => {
  const projects = useProjectStore((state) => state.projects);
  return projects.filter((p) => p.status === 'active');
};

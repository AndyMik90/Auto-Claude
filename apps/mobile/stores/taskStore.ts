/**
 * Task Store
 * Zustand store for task management with Kanban board functionality
 * Uses persist middleware with AsyncStorage for data persistence
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type {
  Task,
  TaskStatus,
  TaskCreateInput,
  TaskUpdateInput,
  TaskFilters,
  TaskSortOptions,
  TaskExecutionState,
} from '../types';

/**
 * Generates a unique ID for new tasks
 */
const generateId = (): string => {
  return `task-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
};

/**
 * Get current timestamp in ISO format
 */
const now = (): string => new Date().toISOString();

/**
 * Mock tasks data - 12 tasks distributed across all 5 Kanban columns
 */
const mockTasks: Task[] = [
  // Backlog tasks (3)
  {
    id: 'task-001',
    title: 'Implement user authentication flow',
    description: 'Add OAuth2 authentication with support for Google and GitHub providers. Include token refresh logic and secure storage.',
    status: 'backlog',
    priority: 'high',
    category: 'feature',
    complexity: 8,
    impact: 9,
    projectId: 'project-001',
    executionState: 'idle',
    labels: ['auth', 'security'],
    createdAt: '2025-01-15T10:00:00Z',
    updatedAt: '2025-01-15T10:00:00Z',
    estimatedDuration: '4 hours',
  },
  {
    id: 'task-002',
    title: 'Add dark mode toggle to settings',
    description: 'Create a toggle in settings to switch between light and dark themes. Persist preference to storage.',
    status: 'backlog',
    priority: 'low',
    category: 'feature',
    complexity: 3,
    impact: 5,
    projectId: 'project-001',
    executionState: 'idle',
    labels: ['ui', 'settings'],
    createdAt: '2025-01-14T15:30:00Z',
    updatedAt: '2025-01-14T15:30:00Z',
    estimatedDuration: '1 hour',
  },
  {
    id: 'task-003',
    title: 'Research GraphQL subscriptions',
    description: 'Investigate best practices for implementing real-time updates using GraphQL subscriptions vs WebSockets.',
    status: 'backlog',
    priority: 'medium',
    category: 'research',
    complexity: 5,
    impact: 6,
    projectId: 'project-002',
    executionState: 'idle',
    labels: ['research', 'graphql'],
    createdAt: '2025-01-13T09:00:00Z',
    updatedAt: '2025-01-13T09:00:00Z',
    estimatedDuration: '2 hours',
  },

  // In Progress tasks (3)
  {
    id: 'task-004',
    title: 'Build notification service',
    description: 'Create a notification service to handle push notifications, in-app alerts, and email digests for task updates.',
    status: 'in_progress',
    priority: 'high',
    category: 'feature',
    complexity: 7,
    impact: 8,
    projectId: 'project-001',
    executionState: 'running',
    terminalSessionId: 'terminal-001',
    labels: ['notifications', 'backend'],
    createdAt: '2025-01-12T11:00:00Z',
    updatedAt: '2025-01-16T14:00:00Z',
    startedAt: '2025-01-16T09:00:00Z',
    estimatedDuration: '3 hours',
  },
  {
    id: 'task-005',
    title: 'Fix memory leak in chat component',
    description: 'Investigate and fix memory leak occurring when switching between chat sessions rapidly.',
    status: 'in_progress',
    priority: 'critical',
    category: 'bug',
    complexity: 6,
    impact: 7,
    projectId: 'project-001',
    executionState: 'running',
    labels: ['bug', 'performance'],
    createdAt: '2025-01-16T08:00:00Z',
    updatedAt: '2025-01-16T16:00:00Z',
    startedAt: '2025-01-16T10:00:00Z',
    githubIssueId: 'issue-042',
  },
  {
    id: 'task-006',
    title: 'Refactor API client module',
    description: 'Consolidate API client code, add retry logic, and improve error handling with proper TypeScript types.',
    status: 'in_progress',
    priority: 'medium',
    category: 'refactor',
    complexity: 5,
    impact: 6,
    projectId: 'project-002',
    executionState: 'paused',
    labels: ['refactor', 'api'],
    createdAt: '2025-01-11T14:00:00Z',
    updatedAt: '2025-01-15T16:00:00Z',
    startedAt: '2025-01-15T09:00:00Z',
    estimatedDuration: '2 hours',
  },

  // AI Review tasks (2)
  {
    id: 'task-007',
    title: 'Add unit tests for task store',
    description: 'Write comprehensive unit tests for the task store including all CRUD operations and edge cases.',
    status: 'ai_review',
    priority: 'medium',
    category: 'test',
    complexity: 4,
    impact: 7,
    projectId: 'project-001',
    executionState: 'completed',
    labels: ['testing', 'stores'],
    createdAt: '2025-01-10T10:00:00Z',
    updatedAt: '2025-01-16T11:00:00Z',
    startedAt: '2025-01-16T09:00:00Z',
    completedAt: '2025-01-16T11:00:00Z',
    estimatedDuration: '1.5 hours',
  },
  {
    id: 'task-008',
    title: 'Update API documentation',
    description: 'Add OpenAPI/Swagger documentation for all REST endpoints. Include request/response examples.',
    status: 'ai_review',
    priority: 'low',
    category: 'documentation',
    complexity: 3,
    impact: 5,
    projectId: 'project-002',
    executionState: 'completed',
    labels: ['docs', 'api'],
    createdAt: '2025-01-09T13:00:00Z',
    updatedAt: '2025-01-15T17:00:00Z',
    startedAt: '2025-01-15T14:00:00Z',
    completedAt: '2025-01-15T17:00:00Z',
  },

  // Human Review tasks (2)
  {
    id: 'task-009',
    title: 'Implement drag-and-drop for Kanban',
    description: 'Add drag-and-drop functionality to move tasks between Kanban columns with smooth animations.',
    status: 'human_review',
    priority: 'high',
    category: 'feature',
    complexity: 7,
    impact: 9,
    projectId: 'project-001',
    executionState: 'completed',
    labels: ['ui', 'kanban'],
    createdAt: '2025-01-08T09:00:00Z',
    updatedAt: '2025-01-14T12:00:00Z',
    startedAt: '2025-01-13T10:00:00Z',
    completedAt: '2025-01-14T12:00:00Z',
    estimatedDuration: '4 hours',
    githubPRId: 'pr-087',
  },
  {
    id: 'task-010',
    title: 'Add error boundary components',
    description: 'Wrap major screen sections with error boundaries to gracefully handle runtime errors.',
    status: 'human_review',
    priority: 'medium',
    category: 'feature',
    complexity: 4,
    impact: 6,
    projectId: 'project-001',
    executionState: 'completed',
    labels: ['error-handling', 'ui'],
    createdAt: '2025-01-07T11:00:00Z',
    updatedAt: '2025-01-13T15:00:00Z',
    startedAt: '2025-01-13T09:00:00Z',
    completedAt: '2025-01-13T15:00:00Z',
    githubPRId: 'pr-085',
  },

  // Done tasks (2)
  {
    id: 'task-011',
    title: 'Set up CI/CD pipeline',
    description: 'Configure GitHub Actions for automated testing, linting, and deployment to staging environment.',
    status: 'done',
    priority: 'high',
    category: 'chore',
    complexity: 6,
    impact: 8,
    projectId: 'project-001',
    executionState: 'completed',
    labels: ['ci-cd', 'devops'],
    createdAt: '2025-01-05T10:00:00Z',
    updatedAt: '2025-01-10T14:00:00Z',
    startedAt: '2025-01-09T09:00:00Z',
    completedAt: '2025-01-10T14:00:00Z',
    estimatedDuration: '3 hours',
  },
  {
    id: 'task-012',
    title: 'Create project README',
    description: 'Write comprehensive README with setup instructions, architecture overview, and contribution guidelines.',
    status: 'done',
    priority: 'medium',
    category: 'documentation',
    complexity: 2,
    impact: 5,
    projectId: 'project-001',
    executionState: 'completed',
    labels: ['docs'],
    createdAt: '2025-01-04T14:00:00Z',
    updatedAt: '2025-01-08T10:00:00Z',
    startedAt: '2025-01-08T09:00:00Z',
    completedAt: '2025-01-08T10:00:00Z',
  },
];

/**
 * Task Store State Interface
 */
interface TaskState {
  /** All tasks in the store */
  tasks: Task[];

  /** Currently selected task ID (for detail view) */
  selectedTaskId: string | null;

  /** Active filters applied to the task list */
  filters: TaskFilters;

  /** Sort options for the task list */
  sortOptions: TaskSortOptions;

  /** Loading state for async operations */
  isLoading: boolean;

  /** Error message if any */
  error: string | null;
}

/**
 * Task Store Actions Interface
 */
interface TaskActions {
  /** Add a new task to the store */
  addTask: (input: TaskCreateInput) => Task;

  /** Update an existing task */
  updateTask: (id: string, updates: TaskUpdateInput) => void;

  /** Delete a task from the store */
  deleteTask: (id: string) => void;

  /** Move a task to a different Kanban column (status) */
  moveTask: (id: string, newStatus: TaskStatus) => void;

  /** Select a task for viewing details */
  selectTask: (id: string | null) => void;

  /** Get a task by ID */
  getTaskById: (id: string) => Task | undefined;

  /** Get all tasks for a specific project */
  getTasksByProject: (projectId: string) => Task[];

  /** Get tasks grouped by status (for Kanban board) */
  getTasksByStatus: () => Record<TaskStatus, Task[]>;

  /** Update task execution state */
  updateExecutionState: (id: string, state: TaskExecutionState) => void;

  /** Set filters */
  setFilters: (filters: TaskFilters) => void;

  /** Clear all filters */
  clearFilters: () => void;

  /** Set sort options */
  setSortOptions: (options: TaskSortOptions) => void;

  /** Get filtered and sorted tasks */
  getFilteredTasks: () => Task[];

  /** Set loading state */
  setLoading: (loading: boolean) => void;

  /** Set error message */
  setError: (error: string | null) => void;

  /** Reset store to initial state (with mock data) */
  resetStore: () => void;
}

/**
 * Combined Task Store Type
 */
type TaskStore = TaskState & TaskActions;

/**
 * Initial state for the store
 */
const initialState: TaskState = {
  tasks: mockTasks,
  selectedTaskId: null,
  filters: {},
  sortOptions: {
    field: 'updatedAt',
    direction: 'desc',
  },
  isLoading: false,
  error: null,
};

/**
 * Task Store
 * Zustand store with persist middleware for AsyncStorage persistence
 */
export const useTaskStore = create<TaskStore>()(
  persist(
    (set, get) => ({
      // Initial state
      ...initialState,

      // Actions
      addTask: (input: TaskCreateInput): Task => {
        const newTask: Task = {
          id: generateId(),
          title: input.title,
          description: input.description,
          status: 'backlog', // New tasks always start in backlog
          priority: input.priority,
          category: input.category,
          complexity: input.complexity,
          impact: input.impact,
          projectId: input.projectId,
          labels: input.labels || [],
          executionState: 'idle',
          createdAt: now(),
          updatedAt: now(),
        };

        set((state) => ({
          tasks: [...state.tasks, newTask],
        }));

        return newTask;
      },

      updateTask: (id: string, updates: TaskUpdateInput): void => {
        set((state) => ({
          tasks: state.tasks.map((task) =>
            task.id === id
              ? { ...task, ...updates, updatedAt: now() }
              : task
          ),
        }));
      },

      deleteTask: (id: string): void => {
        set((state) => ({
          tasks: state.tasks.filter((task) => task.id !== id),
          // Clear selection if deleted task was selected
          selectedTaskId: state.selectedTaskId === id ? null : state.selectedTaskId,
        }));
      },

      moveTask: (id: string, newStatus: TaskStatus): void => {
        set((state) => ({
          tasks: state.tasks.map((task) =>
            task.id === id
              ? {
                  ...task,
                  status: newStatus,
                  updatedAt: now(),
                  // Update execution state based on status
                  executionState:
                    newStatus === 'done'
                      ? 'completed'
                      : newStatus === 'in_progress' && task.executionState === 'idle'
                      ? 'running'
                      : task.executionState,
                  // Set completedAt when moving to done
                  completedAt: newStatus === 'done' ? now() : task.completedAt,
                  // Set startedAt when moving to in_progress
                  startedAt:
                    newStatus === 'in_progress' && !task.startedAt
                      ? now()
                      : task.startedAt,
                }
              : task
          ),
        }));
      },

      selectTask: (id: string | null): void => {
        set({ selectedTaskId: id });
      },

      getTaskById: (id: string): Task | undefined => {
        return get().tasks.find((task) => task.id === id);
      },

      getTasksByProject: (projectId: string): Task[] => {
        return get().tasks.filter((task) => task.projectId === projectId);
      },

      getTasksByStatus: (): Record<TaskStatus, Task[]> => {
        const tasks = get().tasks;
        return {
          backlog: tasks.filter((t) => t.status === 'backlog'),
          in_progress: tasks.filter((t) => t.status === 'in_progress'),
          ai_review: tasks.filter((t) => t.status === 'ai_review'),
          human_review: tasks.filter((t) => t.status === 'human_review'),
          done: tasks.filter((t) => t.status === 'done'),
        };
      },

      updateExecutionState: (id: string, state: TaskExecutionState): void => {
        set((currentState) => ({
          tasks: currentState.tasks.map((task) =>
            task.id === id
              ? {
                  ...task,
                  executionState: state,
                  updatedAt: now(),
                  // Update timestamps based on execution state
                  startedAt:
                    state === 'running' && !task.startedAt
                      ? now()
                      : task.startedAt,
                  completedAt:
                    state === 'completed' || state === 'failed'
                      ? now()
                      : task.completedAt,
                }
              : task
          ),
        }));
      },

      setFilters: (filters: TaskFilters): void => {
        set({ filters });
      },

      clearFilters: (): void => {
        set({ filters: {} });
      },

      setSortOptions: (options: TaskSortOptions): void => {
        set({ sortOptions: options });
      },

      getFilteredTasks: (): Task[] => {
        const { tasks, filters, sortOptions } = get();

        // Apply filters
        let filteredTasks = tasks.filter((task) => {
          // Status filter
          if (filters.status && filters.status.length > 0) {
            if (!filters.status.includes(task.status)) return false;
          }

          // Priority filter
          if (filters.priority && filters.priority.length > 0) {
            if (!filters.priority.includes(task.priority)) return false;
          }

          // Category filter
          if (filters.category && filters.category.length > 0) {
            if (!filters.category.includes(task.category)) return false;
          }

          // Project filter
          if (filters.projectId) {
            if (task.projectId !== filters.projectId) return false;
          }

          // Search filter
          if (filters.search) {
            const searchLower = filters.search.toLowerCase();
            const matchesTitle = task.title.toLowerCase().includes(searchLower);
            const matchesDescription = task.description
              .toLowerCase()
              .includes(searchLower);
            const matchesLabels = task.labels?.some((label) =>
              label.toLowerCase().includes(searchLower)
            );
            if (!matchesTitle && !matchesDescription && !matchesLabels) {
              return false;
            }
          }

          return true;
        });

        // Apply sorting
        filteredTasks.sort((a, b) => {
          let comparison = 0;

          switch (sortOptions.field) {
            case 'createdAt':
              comparison =
                new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
              break;
            case 'updatedAt':
              comparison =
                new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime();
              break;
            case 'priority': {
              const priorityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
              comparison = priorityOrder[a.priority] - priorityOrder[b.priority];
              break;
            }
            case 'complexity':
              comparison = a.complexity - b.complexity;
              break;
            case 'impact':
              comparison = a.impact - b.impact;
              break;
            case 'title':
              comparison = a.title.localeCompare(b.title);
              break;
          }

          return sortOptions.direction === 'desc' ? -comparison : comparison;
        });

        return filteredTasks;
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
      name: 'autoclaude-task-storage',
      storage: createJSONStorage(() => AsyncStorage),
      // Only persist tasks, not UI state
      partialize: (state) => ({
        tasks: state.tasks,
        sortOptions: state.sortOptions,
      }),
    }
  )
);

/**
 * Selector hooks for common use cases
 */

/** Get the currently selected task */
export const useSelectedTask = (): Task | undefined => {
  const { tasks, selectedTaskId } = useTaskStore();
  return tasks.find((task) => task.id === selectedTaskId);
};

/** Get task count by status */
export const useTaskCounts = (): Record<TaskStatus, number> => {
  const tasks = useTaskStore((state) => state.tasks);
  return {
    backlog: tasks.filter((t) => t.status === 'backlog').length,
    in_progress: tasks.filter((t) => t.status === 'in_progress').length,
    ai_review: tasks.filter((t) => t.status === 'ai_review').length,
    human_review: tasks.filter((t) => t.status === 'human_review').length,
    done: tasks.filter((t) => t.status === 'done').length,
  };
};

/** Get total task count */
export const useTotalTaskCount = (): number => {
  return useTaskStore((state) => state.tasks.length);
};

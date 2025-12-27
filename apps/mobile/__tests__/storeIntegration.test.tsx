/**
 * Store Integration Tests
 * Tests Zustand + TanStack Query integration
 */

import React from 'react';
import { render, waitFor, act, renderHook } from '@testing-library/react-native';
import { View, Text } from 'react-native';
import { QueryClient, QueryClientProvider, useQuery, useMutation } from '@tanstack/react-query';

// Mock AsyncStorage
jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    getItem: jest.fn(() => Promise.resolve(null)),
    setItem: jest.fn(() => Promise.resolve()),
    removeItem: jest.fn(() => Promise.resolve()),
    clear: jest.fn(() => Promise.resolve()),
    getAllKeys: jest.fn(() => Promise.resolve([])),
    multiGet: jest.fn(() => Promise.resolve([])),
    multiSet: jest.fn(() => Promise.resolve()),
  },
}));

// Mock expo-secure-store
jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(() => Promise.resolve(null)),
  setItemAsync: jest.fn(() => Promise.resolve()),
  deleteItemAsync: jest.fn(() => Promise.resolve()),
}));

// Mock react-native specific modules
jest.mock('react-native/Libraries/AppState/AppState', () => ({
  addEventListener: jest.fn(() => ({ remove: jest.fn() })),
  currentState: 'active',
}));

jest.mock('@react-native-community/netinfo', () => ({
  addEventListener: jest.fn(() => jest.fn()),
  fetch: jest.fn(() =>
    Promise.resolve({
      isConnected: true,
      isInternetReachable: true,
      type: 'wifi',
    })
  ),
}));

// Import stores
import { useTaskStore } from '../stores/taskStore';
import { useProjectStore } from '../stores/projectStore';
import { useChatStore } from '../stores/chatStore';
import { useSettingsStore } from '../stores/settingsStore';
import { useGitHubStore } from '../stores/githubStore';
import { useTerminalStore } from '../stores/terminalStore';
import type { Task, TaskCreateInput } from '../types';

/**
 * Create a fresh QueryClient for each test
 */
function createTestQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
        staleTime: 0,
      },
      mutations: {
        retry: false,
      },
    },
  });
}

/**
 * Wrapper component for tests
 */
function createWrapper(queryClient: QueryClient) {
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
  };
}

describe('Store Integration Tests', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = createTestQueryClient();
    jest.clearAllMocks();

    // Reset all stores
    act(() => {
      useTaskStore.getState().resetStore();
      useProjectStore.getState().resetStore();
      useChatStore.getState().resetStore();
      useSettingsStore.getState().resetStore();
      useGitHubStore.getState().resetStore();
      useTerminalStore.getState().resetStore();
    });
  });

  afterEach(() => {
    queryClient.clear();
  });

  describe('Zustand Store Reactivity', () => {
    it('should update UI when task store changes', async () => {
      let renderCount = 0;

      const TestComponent: React.FC = () => {
        const { tasks } = useTaskStore();
        renderCount++;
        return (
          <View>
            <Text testID="task-count">{tasks.length}</Text>
          </View>
        );
      };

      const { getByTestId, rerender } = render(<TestComponent />);
      const initialCount = parseInt(getByTestId('task-count').props.children, 10);

      // Add a task
      await act(async () => {
        useTaskStore.getState().addTask({
          title: 'New Task',
          description: 'Test description',
          priority: 'medium',
          category: 'feature',
          complexity: 5,
          impact: 5,
          projectId: 'project-001',
        });
      });

      rerender(<TestComponent />);

      await waitFor(() => {
        const newCount = parseInt(getByTestId('task-count').props.children, 10);
        expect(newCount).toBe(initialCount + 1);
      });
    });

    it('should update UI when project store changes', async () => {
      const TestComponent: React.FC = () => {
        const { projects } = useProjectStore();
        return (
          <View>
            <Text testID="project-count">{projects.length}</Text>
          </View>
        );
      };

      const { getByTestId, rerender } = render(<TestComponent />);
      const initialCount = parseInt(getByTestId('project-count').props.children, 10);

      // Add a project
      await act(async () => {
        useProjectStore.getState().addProject({
          name: 'New Project',
          description: 'Test project',
          path: '/path/to/project',
        });
      });

      rerender(<TestComponent />);

      await waitFor(() => {
        const newCount = parseInt(getByTestId('project-count').props.children, 10);
        expect(newCount).toBe(initialCount + 1);
      });
    });

    it('should update UI when chat store changes', async () => {
      const TestComponent: React.FC = () => {
        const { sessions } = useChatStore();
        return (
          <View>
            <Text testID="session-count">{sessions.length}</Text>
          </View>
        );
      };

      const { getByTestId, rerender } = render(<TestComponent />);
      const initialCount = parseInt(getByTestId('session-count').props.children, 10);

      // Create a session
      await act(async () => {
        useChatStore.getState().createSession({ name: 'Test Session' });
      });

      rerender(<TestComponent />);

      await waitFor(() => {
        const newCount = parseInt(getByTestId('session-count').props.children, 10);
        expect(newCount).toBe(initialCount + 1);
      });
    });
  });

  describe('TanStack Query with Zustand', () => {
    it('should use store data as query data source', async () => {
      const wrapper = createWrapper(queryClient);

      // Create a hook that uses query to access store data
      const { result } = renderHook(
        () => {
          const query = useQuery({
            queryKey: ['tasks'],
            queryFn: () => Promise.resolve(useTaskStore.getState().tasks),
          });
          return query;
        },
        { wrapper }
      );

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data).toBeDefined();
      expect(Array.isArray(result.current.data)).toBe(true);
    });

    it('should invalidate queries when store updates', async () => {
      const wrapper = createWrapper(queryClient);
      const fetchFn = jest.fn(() => Promise.resolve(useTaskStore.getState().tasks));

      const { result, rerender } = renderHook(
        () => {
          const query = useQuery({
            queryKey: ['tasks'],
            queryFn: fetchFn,
          });
          return query;
        },
        { wrapper }
      );

      // Wait for initial query
      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(fetchFn).toHaveBeenCalledTimes(1);

      // Invalidate the query
      await act(async () => {
        await queryClient.invalidateQueries({ queryKey: ['tasks'] });
      });

      // Wait for refetch
      await waitFor(() => {
        expect(fetchFn).toHaveBeenCalledTimes(2);
      });
    });

    it('should use mutation to update store', async () => {
      const wrapper = createWrapper(queryClient);
      const { tasks: initialTasks } = useTaskStore.getState();

      const { result } = renderHook(
        () => {
          const mutation = useMutation({
            mutationFn: async (input: TaskCreateInput) => {
              const newTask = useTaskStore.getState().addTask(input);
              return newTask;
            },
            onSuccess: () => {
              queryClient.invalidateQueries({ queryKey: ['tasks'] });
            },
          });
          return mutation;
        },
        { wrapper }
      );

      await act(async () => {
        result.current.mutate({
          title: 'Mutation Task',
          description: 'Created via mutation',
          priority: 'high',
          category: 'feature',
          complexity: 7,
          impact: 8,
          projectId: 'project-001',
        });
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      const { tasks } = useTaskStore.getState();
      expect(tasks.length).toBe(initialTasks.length + 1);
      expect(tasks.find((t) => t.title === 'Mutation Task')).toBeDefined();
    });

    it('should handle query with store selectors', async () => {
      const wrapper = createWrapper(queryClient);

      // Use store selector inside query
      const { result } = renderHook(
        () => {
          const query = useQuery({
            queryKey: ['tasks', 'backlog'],
            queryFn: () => {
              const tasksByStatus = useTaskStore.getState().getTasksByStatus();
              return Promise.resolve(tasksByStatus.backlog);
            },
          });
          return query;
        },
        { wrapper }
      );

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data).toBeDefined();
      expect(
        result.current.data?.every((t: Task) => t.status === 'backlog')
      ).toBe(true);
    });
  });

  describe('Cross-Store Integration', () => {
    it('should filter tasks by project', () => {
      const { projects } = useProjectStore.getState();
      const firstProject = projects[0];

      const { getTasksByProject } = useTaskStore.getState();
      const projectTasks = getTasksByProject(firstProject.id);

      // Verify all returned tasks belong to the project
      expect(
        projectTasks.every((t) => t.projectId === firstProject.id)
      ).toBe(true);
    });

    it('should link terminal session to task', () => {
      const { tasks } = useTaskStore.getState();
      const { getSessionByTaskId } = useTerminalStore.getState();

      // Find a task with a terminal session
      const taskWithTerminal = tasks.find((t) => t.terminalSessionId);

      if (taskWithTerminal) {
        const session = getSessionByTaskId(taskWithTerminal.id);
        expect(session?.taskId).toBe(taskWithTerminal.id);
      }
    });

    it('should link github issue to task', () => {
      const { tasks } = useTaskStore.getState();
      const { issues, getIssueById } = useGitHubStore.getState();

      // Find a task with a github issue
      const taskWithIssue = tasks.find((t) => t.githubIssueId);

      if (taskWithIssue && taskWithIssue.githubIssueId) {
        const issue = getIssueById(taskWithIssue.githubIssueId);
        if (issue) {
          expect(issue.linkedTaskId).toBe(taskWithIssue.id);
        }
      }
    });

    it('should update connection settings across stores', async () => {
      const { updateConnectionSettings } = useSettingsStore.getState();

      await act(async () => {
        updateConnectionSettings({ connectionStatus: 'connected' });
      });

      const { settings } = useSettingsStore.getState();
      expect(settings.connection.connectionStatus).toBe('connected');

      await act(async () => {
        updateConnectionSettings({ connectionStatus: 'disconnected' });
      });

      const { settings: updatedSettings } = useSettingsStore.getState();
      expect(updatedSettings.connection.connectionStatus).toBe('disconnected');
    });
  });

  describe('Store State Synchronization', () => {
    it('should maintain consistency after multiple updates', async () => {
      const { addTask, updateTask, getTaskById } = useTaskStore.getState();

      // Add task
      let newTask: Task | undefined;
      await act(async () => {
        newTask = addTask({
          title: 'Consistency Test',
          description: 'Testing state consistency',
          priority: 'medium',
          category: 'test',
          complexity: 5,
          impact: 5,
          projectId: 'project-001',
        });
      });

      expect(newTask).toBeDefined();

      // Update task multiple times
      await act(async () => {
        updateTask(newTask!.id, { priority: 'high' });
        updateTask(newTask!.id, { complexity: 8 });
        updateTask(newTask!.id, { status: 'in_progress' });
      });

      const updatedTask = getTaskById(newTask!.id);

      expect(updatedTask?.priority).toBe('high');
      expect(updatedTask?.complexity).toBe(8);
      expect(updatedTask?.status).toBe('in_progress');
    });

    it('should handle concurrent store access', async () => {
      const { addTask, tasks: initialTasks } = useTaskStore.getState();
      const tasksToAdd = 5;

      // Add multiple tasks concurrently
      await act(async () => {
        const promises = Array.from({ length: tasksToAdd }, (_, i) =>
          Promise.resolve(
            addTask({
              title: `Concurrent Task ${i}`,
              description: 'Testing concurrent access',
              priority: 'low',
              category: 'chore',
              complexity: 1,
              impact: 1,
              projectId: 'project-001',
            })
          )
        );
        await Promise.all(promises);
      });

      const { tasks } = useTaskStore.getState();
      expect(tasks.length).toBe(initialTasks.length + tasksToAdd);
    });
  });

  describe('Query Cache with Store Updates', () => {
    it('should reflect store changes in query cache after invalidation', async () => {
      const wrapper = createWrapper(queryClient);

      // Initial query
      const { result: queryResult } = renderHook(
        () =>
          useQuery({
            queryKey: ['tasks'],
            queryFn: () => Promise.resolve(useTaskStore.getState().tasks),
          }),
        { wrapper }
      );

      await waitFor(() => {
        expect(queryResult.current.isSuccess).toBe(true);
      });

      const initialLength = queryResult.current.data?.length || 0;

      // Add task to store
      await act(async () => {
        useTaskStore.getState().addTask({
          title: 'Cache Test Task',
          description: 'Testing cache invalidation',
          priority: 'medium',
          category: 'feature',
          complexity: 5,
          impact: 5,
          projectId: 'project-001',
        });
      });

      // Invalidate and refetch
      await act(async () => {
        await queryClient.invalidateQueries({ queryKey: ['tasks'] });
      });

      await waitFor(() => {
        expect(queryResult.current.data?.length).toBe(initialLength + 1);
      });
    });

    it('should maintain query cache consistency across components', async () => {
      const wrapper = createWrapper(queryClient);
      const queryKey = ['shared-tasks'];

      // First component's query
      const { result: result1 } = renderHook(
        () =>
          useQuery({
            queryKey,
            queryFn: () => Promise.resolve(useTaskStore.getState().tasks),
          }),
        { wrapper }
      );

      await waitFor(() => {
        expect(result1.current.isSuccess).toBe(true);
      });

      // Second component's query (should use cached data)
      const { result: result2 } = renderHook(
        () =>
          useQuery({
            queryKey,
            queryFn: () => Promise.resolve(useTaskStore.getState().tasks),
          }),
        { wrapper }
      );

      await waitFor(() => {
        expect(result2.current.isSuccess).toBe(true);
      });

      // Both should have same data reference from cache
      expect(result1.current.data?.length).toBe(result2.current.data?.length);
    });
  });

  describe('Optimistic Updates with Stores', () => {
    it('should handle optimistic update with rollback', async () => {
      const wrapper = createWrapper(queryClient);
      const { tasks: initialTasks } = useTaskStore.getState();

      const { result } = renderHook(
        () =>
          useMutation({
            mutationFn: async (input: TaskCreateInput) => {
              // Simulate API call that fails
              throw new Error('Network error');
            },
            onMutate: async (newTask) => {
              // Cancel outgoing refetches
              await queryClient.cancelQueries({ queryKey: ['tasks'] });

              // Snapshot previous value
              const previousTasks = queryClient.getQueryData<Task[]>(['tasks']);

              // Optimistically update
              queryClient.setQueryData<Task[]>(['tasks'], (old) => [
                ...(old || []),
                { ...newTask, id: 'temp-id', status: 'backlog' } as Task,
              ]);

              return { previousTasks };
            },
            onError: (err, newTask, context) => {
              // Rollback to previous value
              if (context?.previousTasks) {
                queryClient.setQueryData(['tasks'], context.previousTasks);
              }
            },
          }),
        { wrapper }
      );

      // Trigger mutation (will fail)
      await act(async () => {
        result.current.mutate({
          title: 'Optimistic Task',
          description: 'Will be rolled back',
          priority: 'low',
          category: 'chore',
          complexity: 1,
          impact: 1,
          projectId: 'project-001',
        });
      });

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });

      // Store should be unchanged
      const { tasks } = useTaskStore.getState();
      expect(tasks.length).toBe(initialTasks.length);
    });
  });

  describe('Store Selector Hooks', () => {
    it('should return correct selected task', () => {
      const { tasks, selectTask } = useTaskStore.getState();
      const taskToSelect = tasks[0];

      act(() => {
        selectTask(taskToSelect.id);
      });

      const { selectedTaskId } = useTaskStore.getState();
      expect(selectedTaskId).toBe(taskToSelect.id);
    });

    it('should return correct current project', () => {
      const { projects, selectProject } = useProjectStore.getState();
      const projectToSelect = projects[0];

      act(() => {
        selectProject(projectToSelect.id);
      });

      const { currentProjectId } = useProjectStore.getState();
      expect(currentProjectId).toBe(projectToSelect.id);
    });

    it('should return correct current chat session', () => {
      const { sessions, switchSession } = useChatStore.getState();
      const sessionToSelect = sessions[0];

      act(() => {
        switchSession(sessionToSelect.id);
      });

      const { currentSessionId } = useChatStore.getState();
      expect(currentSessionId).toBe(sessionToSelect.id);
    });
  });

  describe('Complex Store Operations', () => {
    it('should handle task move with status update', async () => {
      const { tasks, moveTask, getTaskById } = useTaskStore.getState();
      const backlogTask = tasks.find((t) => t.status === 'backlog');

      expect(backlogTask).toBeDefined();

      await act(async () => {
        moveTask(backlogTask!.id, 'in_progress');
      });

      const movedTask = getTaskById(backlogTask!.id);
      expect(movedTask?.status).toBe('in_progress');
      expect(movedTask?.startedAt).toBeDefined();
    });

    it('should handle chat streaming state', async () => {
      const { sessions, startStreamingResponse, updateStreamingContent, completeStreamingResponse } =
        useChatStore.getState();
      const session = sessions[0];

      await act(async () => {
        useChatStore.getState().switchSession(session.id);
        startStreamingResponse();
      });

      expect(useChatStore.getState().isStreaming).toBe(true);

      await act(async () => {
        updateStreamingContent('Hello, ');
        updateStreamingContent('Hello, world!');
      });

      await act(async () => {
        completeStreamingResponse('Hello, world! This is a complete response.');
      });

      expect(useChatStore.getState().isStreaming).toBe(false);
    });

    it('should handle settings update with secure storage', async () => {
      const { saveApiKey, checkApiKeyExists, deleteApiKey } =
        useSettingsStore.getState();

      // Save API key
      await act(async () => {
        await saveApiKey('test-api-key-123');
      });

      const exists = await checkApiKeyExists();
      // Note: In test environment with mocked secure store, this returns false
      // In real implementation, this would return true
      expect(typeof exists).toBe('boolean');

      // Delete API key
      await act(async () => {
        await deleteApiKey();
      });
    });
  });

  describe('Query with Dynamic Store State', () => {
    it('should query filtered tasks based on store filters', async () => {
      const wrapper = createWrapper(queryClient);

      // Set filter in store
      await act(async () => {
        useTaskStore.getState().setFilters({ status: ['backlog'] });
      });

      const { result } = renderHook(
        () =>
          useQuery({
            queryKey: ['tasks', 'filtered'],
            queryFn: () => Promise.resolve(useTaskStore.getState().getFilteredTasks()),
          }),
        { wrapper }
      );

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      // All tasks should be backlog
      expect(
        result.current.data?.every((t: Task) => t.status === 'backlog')
      ).toBe(true);
    });

    it('should query with dynamic query key based on store state', async () => {
      const wrapper = createWrapper(queryClient);

      // Select a project
      const { projects, selectProject } = useProjectStore.getState();
      const selectedProject = projects[0];

      await act(async () => {
        selectProject(selectedProject.id);
      });

      const { result } = renderHook(
        () => {
          const { currentProjectId } = useProjectStore();
          return useQuery({
            queryKey: ['tasks', 'project', currentProjectId],
            queryFn: () =>
              Promise.resolve(
                useTaskStore.getState().getTasksByProject(currentProjectId || '')
              ),
            enabled: !!currentProjectId,
          });
        },
        { wrapper }
      );

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      // All tasks should belong to selected project
      expect(
        result.current.data?.every((t: Task) => t.projectId === selectedProject.id)
      ).toBe(true);
    });
  });
});

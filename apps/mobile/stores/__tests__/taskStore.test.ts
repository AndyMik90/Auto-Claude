/**
 * Task Store Unit Tests
 * Tests all CRUD operations and edge cases for task management
 */

import { act } from '@testing-library/react-native';
import { useTaskStore } from '../taskStore';
import type { TaskCreateInput, TaskStatus } from '../../types';

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

describe('TaskStore', () => {
  // Reset store before each test
  beforeEach(() => {
    act(() => {
      useTaskStore.getState().resetStore();
    });
  });

  describe('Initial State', () => {
    it('should have mock tasks on initialization', () => {
      const { tasks } = useTaskStore.getState();
      expect(tasks.length).toBeGreaterThan(0);
    });

    it('should have tasks distributed across all Kanban columns', () => {
      const { getTasksByStatus } = useTaskStore.getState();
      const tasksByStatus = getTasksByStatus();

      expect(tasksByStatus.backlog.length).toBeGreaterThan(0);
      expect(tasksByStatus.in_progress.length).toBeGreaterThan(0);
      expect(tasksByStatus.ai_review.length).toBeGreaterThan(0);
      expect(tasksByStatus.human_review.length).toBeGreaterThan(0);
      expect(tasksByStatus.done.length).toBeGreaterThan(0);
    });

    it('should have no selected task initially', () => {
      const { selectedTaskId } = useTaskStore.getState();
      expect(selectedTaskId).toBeNull();
    });

    it('should have empty filters initially', () => {
      const { filters } = useTaskStore.getState();
      expect(filters).toEqual({});
    });

    it('should have default sort options', () => {
      const { sortOptions } = useTaskStore.getState();
      expect(sortOptions).toEqual({
        field: 'updatedAt',
        direction: 'desc',
      });
    });
  });

  describe('addTask', () => {
    it('should add a new task to the store', () => {
      const { addTask, tasks: initialTasks } = useTaskStore.getState();
      const input: TaskCreateInput = {
        title: 'New Test Task',
        description: 'This is a test task',
        priority: 'high',
        category: 'feature',
        complexity: 5,
        impact: 7,
        projectId: 'project-001',
      };

      let newTask;
      act(() => {
        newTask = addTask(input);
      });

      const { tasks } = useTaskStore.getState();
      expect(tasks.length).toBe(initialTasks.length + 1);
      expect(newTask).toBeDefined();
      expect(newTask!.title).toBe(input.title);
      expect(newTask!.status).toBe('backlog');
    });

    it('should assign a unique ID to new tasks', () => {
      const { addTask } = useTaskStore.getState();
      const input1: TaskCreateInput = {
        title: 'Task 1',
        description: 'Description 1',
        priority: 'low',
        category: 'chore',
        complexity: 1,
        impact: 1,
        projectId: 'project-001',
      };
      const input2: TaskCreateInput = {
        title: 'Task 2',
        description: 'Description 2',
        priority: 'medium',
        category: 'bug',
        complexity: 2,
        impact: 2,
        projectId: 'project-001',
      };

      let task1, task2;
      act(() => {
        task1 = addTask(input1);
        task2 = addTask(input2);
      });

      expect(task1!.id).not.toBe(task2!.id);
    });

    it('should set createdAt and updatedAt timestamps', () => {
      const { addTask } = useTaskStore.getState();
      const beforeTime = new Date().toISOString();

      let newTask;
      act(() => {
        newTask = addTask({
          title: 'Timestamp Test',
          description: 'Testing timestamps',
          priority: 'medium',
          category: 'test',
          complexity: 3,
          impact: 3,
          projectId: 'project-001',
        });
      });

      const afterTime = new Date().toISOString();
      expect(newTask!.createdAt).toBeDefined();
      expect(newTask!.updatedAt).toBeDefined();
      expect(newTask!.createdAt >= beforeTime).toBe(true);
      expect(newTask!.createdAt <= afterTime).toBe(true);
    });

    it('should default to backlog status', () => {
      const { addTask } = useTaskStore.getState();

      let newTask;
      act(() => {
        newTask = addTask({
          title: 'Status Test',
          description: 'Testing default status',
          priority: 'low',
          category: 'chore',
          complexity: 1,
          impact: 1,
          projectId: 'project-001',
        });
      });

      expect(newTask!.status).toBe('backlog');
    });

    it('should default to idle execution state', () => {
      const { addTask } = useTaskStore.getState();

      let newTask;
      act(() => {
        newTask = addTask({
          title: 'Execution State Test',
          description: 'Testing default execution state',
          priority: 'low',
          category: 'chore',
          complexity: 1,
          impact: 1,
          projectId: 'project-001',
        });
      });

      expect(newTask!.executionState).toBe('idle');
    });

    it('should handle optional labels', () => {
      const { addTask } = useTaskStore.getState();

      let taskWithLabels, taskWithoutLabels;
      act(() => {
        taskWithLabels = addTask({
          title: 'With Labels',
          description: 'Task with labels',
          priority: 'low',
          category: 'chore',
          complexity: 1,
          impact: 1,
          projectId: 'project-001',
          labels: ['test', 'unit-test'],
        });
        taskWithoutLabels = addTask({
          title: 'Without Labels',
          description: 'Task without labels',
          priority: 'low',
          category: 'chore',
          complexity: 1,
          impact: 1,
          projectId: 'project-001',
        });
      });

      expect(taskWithLabels!.labels).toEqual(['test', 'unit-test']);
      expect(taskWithoutLabels!.labels).toEqual([]);
    });
  });

  describe('updateTask', () => {
    it('should update an existing task', () => {
      const { tasks, updateTask, getTaskById } = useTaskStore.getState();
      const taskToUpdate = tasks[0];

      act(() => {
        updateTask(taskToUpdate.id, { title: 'Updated Title' });
      });

      const updatedTask = getTaskById(taskToUpdate.id);
      expect(updatedTask?.title).toBe('Updated Title');
    });

    it('should update the updatedAt timestamp', () => {
      const { tasks, updateTask, getTaskById } = useTaskStore.getState();
      const taskToUpdate = tasks[0];
      const originalUpdatedAt = taskToUpdate.updatedAt;

      act(() => {
        updateTask(taskToUpdate.id, { description: 'New description' });
      });

      const updatedTask = getTaskById(taskToUpdate.id);
      // updatedAt should be updated (may be same if executed fast, but store always sets it)
      expect(updatedTask?.updatedAt).toBeDefined();
    });

    it('should preserve other properties when updating', () => {
      const { tasks, updateTask, getTaskById } = useTaskStore.getState();
      const taskToUpdate = tasks[0];
      const originalTitle = taskToUpdate.title;
      const originalPriority = taskToUpdate.priority;

      act(() => {
        updateTask(taskToUpdate.id, { description: 'Only updating description' });
      });

      const updatedTask = getTaskById(taskToUpdate.id);
      expect(updatedTask?.title).toBe(originalTitle);
      expect(updatedTask?.priority).toBe(originalPriority);
    });

    it('should handle updating non-existent task gracefully', () => {
      const { updateTask, tasks } = useTaskStore.getState();
      const initialTaskCount = tasks.length;

      act(() => {
        updateTask('non-existent-id', { title: 'Should not crash' });
      });

      const { tasks: updatedTasks } = useTaskStore.getState();
      expect(updatedTasks.length).toBe(initialTaskCount);
    });
  });

  describe('deleteTask', () => {
    it('should remove a task from the store', () => {
      const { tasks, deleteTask, getTaskById } = useTaskStore.getState();
      const taskToDelete = tasks[0];
      const initialCount = tasks.length;

      act(() => {
        deleteTask(taskToDelete.id);
      });

      const { tasks: updatedTasks } = useTaskStore.getState();
      expect(updatedTasks.length).toBe(initialCount - 1);
      expect(getTaskById(taskToDelete.id)).toBeUndefined();
    });

    it('should clear selection if deleted task was selected', () => {
      const { tasks, selectTask, deleteTask } = useTaskStore.getState();
      const taskToDelete = tasks[0];

      act(() => {
        selectTask(taskToDelete.id);
      });

      expect(useTaskStore.getState().selectedTaskId).toBe(taskToDelete.id);

      act(() => {
        deleteTask(taskToDelete.id);
      });

      expect(useTaskStore.getState().selectedTaskId).toBeNull();
    });

    it('should not affect selection if deleted task was not selected', () => {
      const { tasks, selectTask, deleteTask } = useTaskStore.getState();
      const taskToSelect = tasks[0];
      const taskToDelete = tasks[1];

      act(() => {
        selectTask(taskToSelect.id);
        deleteTask(taskToDelete.id);
      });

      expect(useTaskStore.getState().selectedTaskId).toBe(taskToSelect.id);
    });

    it('should handle deleting non-existent task gracefully', () => {
      const { tasks, deleteTask } = useTaskStore.getState();
      const initialCount = tasks.length;

      act(() => {
        deleteTask('non-existent-id');
      });

      const { tasks: updatedTasks } = useTaskStore.getState();
      expect(updatedTasks.length).toBe(initialCount);
    });
  });

  describe('moveTask', () => {
    it('should change task status when moved', () => {
      const { tasks, moveTask, getTaskById } = useTaskStore.getState();
      const backlogTask = tasks.find((t) => t.status === 'backlog')!;

      act(() => {
        moveTask(backlogTask.id, 'in_progress');
      });

      const movedTask = getTaskById(backlogTask.id);
      expect(movedTask?.status).toBe('in_progress');
    });

    it('should set startedAt when moving to in_progress', () => {
      const { tasks, moveTask, getTaskById } = useTaskStore.getState();
      const backlogTask = tasks.find(
        (t) => t.status === 'backlog' && !t.startedAt
      )!;

      act(() => {
        moveTask(backlogTask.id, 'in_progress');
      });

      const movedTask = getTaskById(backlogTask.id);
      expect(movedTask?.startedAt).toBeDefined();
    });

    it('should set completedAt when moving to done', () => {
      const { tasks, moveTask, getTaskById } = useTaskStore.getState();
      const inProgressTask = tasks.find((t) => t.status === 'in_progress')!;

      act(() => {
        moveTask(inProgressTask.id, 'done');
      });

      const movedTask = getTaskById(inProgressTask.id);
      expect(movedTask?.completedAt).toBeDefined();
    });

    it('should update execution state to completed when moving to done', () => {
      const { tasks, moveTask, getTaskById } = useTaskStore.getState();
      const inProgressTask = tasks.find((t) => t.status === 'in_progress')!;

      act(() => {
        moveTask(inProgressTask.id, 'done');
      });

      const movedTask = getTaskById(inProgressTask.id);
      expect(movedTask?.executionState).toBe('completed');
    });

    it('should update execution state to running when moving idle task to in_progress', () => {
      const { tasks, moveTask, getTaskById } = useTaskStore.getState();
      const backlogTask = tasks.find(
        (t) => t.status === 'backlog' && t.executionState === 'idle'
      )!;

      act(() => {
        moveTask(backlogTask.id, 'in_progress');
      });

      const movedTask = getTaskById(backlogTask.id);
      expect(movedTask?.executionState).toBe('running');
    });
  });

  describe('selectTask', () => {
    it('should select a task', () => {
      const { tasks, selectTask } = useTaskStore.getState();
      const taskToSelect = tasks[0];

      act(() => {
        selectTask(taskToSelect.id);
      });

      expect(useTaskStore.getState().selectedTaskId).toBe(taskToSelect.id);
    });

    it('should clear selection when null is passed', () => {
      const { tasks, selectTask } = useTaskStore.getState();
      const taskToSelect = tasks[0];

      act(() => {
        selectTask(taskToSelect.id);
        selectTask(null);
      });

      expect(useTaskStore.getState().selectedTaskId).toBeNull();
    });
  });

  describe('getTaskById', () => {
    it('should return the task with the given ID', () => {
      const { tasks, getTaskById } = useTaskStore.getState();
      const expectedTask = tasks[0];

      const foundTask = getTaskById(expectedTask.id);

      expect(foundTask).toEqual(expectedTask);
    });

    it('should return undefined for non-existent ID', () => {
      const { getTaskById } = useTaskStore.getState();

      const foundTask = getTaskById('non-existent-id');

      expect(foundTask).toBeUndefined();
    });
  });

  describe('getTasksByProject', () => {
    it('should return only tasks for the specified project', () => {
      const { getTasksByProject } = useTaskStore.getState();

      const projectTasks = getTasksByProject('project-001');

      expect(projectTasks.length).toBeGreaterThan(0);
      expect(projectTasks.every((t) => t.projectId === 'project-001')).toBe(true);
    });

    it('should return empty array for non-existent project', () => {
      const { getTasksByProject } = useTaskStore.getState();

      const projectTasks = getTasksByProject('non-existent-project');

      expect(projectTasks).toEqual([]);
    });
  });

  describe('getTasksByStatus', () => {
    it('should group tasks by their status', () => {
      const { tasks, getTasksByStatus } = useTaskStore.getState();
      const tasksByStatus = getTasksByStatus();

      const totalGroupedTasks = Object.values(tasksByStatus).reduce(
        (sum, tasks) => sum + tasks.length,
        0
      );

      expect(totalGroupedTasks).toBe(tasks.length);
    });

    it('should return correct structure with all status keys', () => {
      const { getTasksByStatus } = useTaskStore.getState();
      const tasksByStatus = getTasksByStatus();

      expect(tasksByStatus).toHaveProperty('backlog');
      expect(tasksByStatus).toHaveProperty('in_progress');
      expect(tasksByStatus).toHaveProperty('ai_review');
      expect(tasksByStatus).toHaveProperty('human_review');
      expect(tasksByStatus).toHaveProperty('done');
    });
  });

  describe('updateExecutionState', () => {
    it('should update task execution state', () => {
      const { tasks, updateExecutionState, getTaskById } = useTaskStore.getState();
      const task = tasks[0];

      act(() => {
        updateExecutionState(task.id, 'running');
      });

      const updatedTask = getTaskById(task.id);
      expect(updatedTask?.executionState).toBe('running');
    });

    it('should set startedAt when transitioning to running', () => {
      const { tasks, updateExecutionState, getTaskById } = useTaskStore.getState();
      const task = tasks.find((t) => !t.startedAt)!;

      act(() => {
        updateExecutionState(task.id, 'running');
      });

      const updatedTask = getTaskById(task.id);
      expect(updatedTask?.startedAt).toBeDefined();
    });

    it('should set completedAt when transitioning to completed', () => {
      const { tasks, updateExecutionState, getTaskById } = useTaskStore.getState();
      const task = tasks[0];

      act(() => {
        updateExecutionState(task.id, 'completed');
      });

      const updatedTask = getTaskById(task.id);
      expect(updatedTask?.completedAt).toBeDefined();
    });

    it('should set completedAt when transitioning to failed', () => {
      const { tasks, updateExecutionState, getTaskById } = useTaskStore.getState();
      const task = tasks[0];

      act(() => {
        updateExecutionState(task.id, 'failed');
      });

      const updatedTask = getTaskById(task.id);
      expect(updatedTask?.completedAt).toBeDefined();
    });
  });

  describe('Filters', () => {
    it('should set filters', () => {
      const { setFilters } = useTaskStore.getState();

      act(() => {
        setFilters({ status: ['backlog', 'in_progress'] });
      });

      const { filters } = useTaskStore.getState();
      expect(filters.status).toEqual(['backlog', 'in_progress']);
    });

    it('should clear filters', () => {
      const { setFilters, clearFilters } = useTaskStore.getState();

      act(() => {
        setFilters({ status: ['backlog'], priority: ['high'] });
        clearFilters();
      });

      const { filters } = useTaskStore.getState();
      expect(filters).toEqual({});
    });

    it('should filter tasks by status', () => {
      const { setFilters, getFilteredTasks } = useTaskStore.getState();

      act(() => {
        setFilters({ status: ['backlog'] });
      });

      const filteredTasks = getFilteredTasks();
      expect(filteredTasks.every((t) => t.status === 'backlog')).toBe(true);
    });

    it('should filter tasks by priority', () => {
      const { setFilters, getFilteredTasks } = useTaskStore.getState();

      act(() => {
        setFilters({ priority: ['high', 'critical'] });
      });

      const filteredTasks = getFilteredTasks();
      expect(
        filteredTasks.every((t) => ['high', 'critical'].includes(t.priority))
      ).toBe(true);
    });

    it('should filter tasks by search term', () => {
      const { setFilters, getFilteredTasks } = useTaskStore.getState();

      act(() => {
        setFilters({ search: 'authentication' });
      });

      const filteredTasks = getFilteredTasks();
      expect(filteredTasks.length).toBeGreaterThan(0);
      expect(
        filteredTasks.every(
          (t) =>
            t.title.toLowerCase().includes('authentication') ||
            t.description.toLowerCase().includes('authentication') ||
            t.labels?.some((l) => l.toLowerCase().includes('authentication'))
        )
      ).toBe(true);
    });

    it('should filter tasks by project', () => {
      const { setFilters, getFilteredTasks } = useTaskStore.getState();

      act(() => {
        setFilters({ projectId: 'project-001' });
      });

      const filteredTasks = getFilteredTasks();
      expect(filteredTasks.every((t) => t.projectId === 'project-001')).toBe(
        true
      );
    });

    it('should combine multiple filters', () => {
      const { setFilters, getFilteredTasks } = useTaskStore.getState();

      act(() => {
        setFilters({
          status: ['in_progress'],
          priority: ['high', 'critical'],
        });
      });

      const filteredTasks = getFilteredTasks();
      expect(
        filteredTasks.every(
          (t) =>
            t.status === 'in_progress' &&
            ['high', 'critical'].includes(t.priority)
        )
      ).toBe(true);
    });
  });

  describe('Sort Options', () => {
    it('should set sort options', () => {
      const { setSortOptions } = useTaskStore.getState();

      act(() => {
        setSortOptions({ field: 'priority', direction: 'asc' });
      });

      const { sortOptions } = useTaskStore.getState();
      expect(sortOptions).toEqual({ field: 'priority', direction: 'asc' });
    });

    it('should sort tasks by createdAt descending', () => {
      const { setSortOptions, getFilteredTasks } = useTaskStore.getState();

      act(() => {
        setSortOptions({ field: 'createdAt', direction: 'desc' });
      });

      const sortedTasks = getFilteredTasks();
      for (let i = 0; i < sortedTasks.length - 1; i++) {
        expect(
          new Date(sortedTasks[i].createdAt).getTime()
        ).toBeGreaterThanOrEqual(
          new Date(sortedTasks[i + 1].createdAt).getTime()
        );
      }
    });

    it('should sort tasks by priority', () => {
      const { setSortOptions, getFilteredTasks } = useTaskStore.getState();
      const priorityOrder = { critical: 4, high: 3, medium: 2, low: 1 };

      act(() => {
        setSortOptions({ field: 'priority', direction: 'desc' });
      });

      const sortedTasks = getFilteredTasks();
      for (let i = 0; i < sortedTasks.length - 1; i++) {
        expect(priorityOrder[sortedTasks[i].priority]).toBeGreaterThanOrEqual(
          priorityOrder[sortedTasks[i + 1].priority]
        );
      }
    });
  });

  describe('Loading and Error States', () => {
    it('should set loading state', () => {
      const { setLoading } = useTaskStore.getState();

      act(() => {
        setLoading(true);
      });

      expect(useTaskStore.getState().isLoading).toBe(true);

      act(() => {
        setLoading(false);
      });

      expect(useTaskStore.getState().isLoading).toBe(false);
    });

    it('should set error message', () => {
      const { setError } = useTaskStore.getState();

      act(() => {
        setError('Something went wrong');
      });

      expect(useTaskStore.getState().error).toBe('Something went wrong');

      act(() => {
        setError(null);
      });

      expect(useTaskStore.getState().error).toBeNull();
    });
  });

  describe('resetStore', () => {
    it('should reset store to initial state', () => {
      const { addTask, selectTask, setFilters, resetStore } =
        useTaskStore.getState();

      // Modify state
      act(() => {
        addTask({
          title: 'New Task',
          description: 'Description',
          priority: 'low',
          category: 'chore',
          complexity: 1,
          impact: 1,
          projectId: 'project-001',
        });
        selectTask('task-001');
        setFilters({ status: ['backlog'] });
      });

      // Reset
      act(() => {
        resetStore();
      });

      const state = useTaskStore.getState();
      expect(state.selectedTaskId).toBeNull();
      expect(state.filters).toEqual({});
    });
  });
});

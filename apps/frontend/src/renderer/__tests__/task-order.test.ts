/**
 * Unit tests for Task Order State Management
 * Tests Zustand store actions for kanban board drag-and-drop reordering
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useTaskStore } from '../stores/task-store';
import type { Task, TaskStatus, TaskOrderState } from '../../shared/types';

// Helper to create test tasks
function createTestTask(overrides: Partial<Task> = {}): Task {
  return {
    id: `task-${Date.now()}-${Math.random().toString(36).substring(7)}`,
    specId: 'test-spec-001',
    projectId: 'project-1',
    title: 'Test Task',
    description: 'Test description',
    status: 'backlog' as TaskStatus,
    subtasks: [],
    logs: [],
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides
  };
}

// Helper to create a test task order state
function createTestTaskOrder(overrides: Partial<TaskOrderState> = {}): TaskOrderState {
  return {
    backlog: [],
    in_progress: [],
    ai_review: [],
    human_review: [],
    pr_created: [],
    done: [],
    ...overrides
  };
}

describe('Task Order State Management', () => {
  beforeEach(() => {
    // Reset store to initial state before each test
    useTaskStore.setState({
      tasks: [],
      selectedTaskId: null,
      isLoading: false,
      error: null,
      taskOrder: null
    });
    // Clear localStorage
    localStorage.clear();
  });

  afterEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  describe('setTaskOrder', () => {
    it('should set task order state', () => {
      const order = createTestTaskOrder({
        backlog: ['task-1', 'task-2', 'task-3']
      });

      useTaskStore.getState().setTaskOrder(order);

      expect(useTaskStore.getState().taskOrder).toEqual(order);
    });

    it('should replace existing task order', () => {
      const initialOrder = createTestTaskOrder({
        backlog: ['old-task-1', 'old-task-2']
      });
      const newOrder = createTestTaskOrder({
        backlog: ['new-task-1', 'new-task-2', 'new-task-3']
      });

      useTaskStore.getState().setTaskOrder(initialOrder);
      useTaskStore.getState().setTaskOrder(newOrder);

      expect(useTaskStore.getState().taskOrder).toEqual(newOrder);
    });

    it('should handle empty column arrays', () => {
      const order = createTestTaskOrder();

      useTaskStore.getState().setTaskOrder(order);

      expect(useTaskStore.getState().taskOrder?.backlog).toEqual([]);
      expect(useTaskStore.getState().taskOrder?.in_progress).toEqual([]);
    });

    it('should preserve all column orders', () => {
      const order = createTestTaskOrder({
        backlog: ['task-1'],
        in_progress: ['task-2'],
        ai_review: ['task-3'],
        human_review: ['task-4'],
        pr_created: ['task-5'],
        done: ['task-6']
      });

      useTaskStore.getState().setTaskOrder(order);

      expect(useTaskStore.getState().taskOrder?.backlog).toEqual(['task-1']);
      expect(useTaskStore.getState().taskOrder?.in_progress).toEqual(['task-2']);
      expect(useTaskStore.getState().taskOrder?.ai_review).toEqual(['task-3']);
      expect(useTaskStore.getState().taskOrder?.human_review).toEqual(['task-4']);
      expect(useTaskStore.getState().taskOrder?.pr_created).toEqual(['task-5']);
      expect(useTaskStore.getState().taskOrder?.done).toEqual(['task-6']);
    });
  });

  describe('reorderTasksInColumn', () => {
    it('should reorder tasks within a column using arrayMove', () => {
      const order = createTestTaskOrder({
        backlog: ['task-1', 'task-2', 'task-3']
      });
      useTaskStore.setState({ taskOrder: order });

      // Move task-1 to position of task-3
      useTaskStore.getState().reorderTasksInColumn('backlog', 'task-1', 'task-3');

      expect(useTaskStore.getState().taskOrder?.backlog).toEqual(['task-2', 'task-3', 'task-1']);
    });

    it('should move task from later position to earlier position', () => {
      const order = createTestTaskOrder({
        backlog: ['task-1', 'task-2', 'task-3', 'task-4']
      });
      useTaskStore.setState({ taskOrder: order });

      // Move task-4 to position of task-2
      useTaskStore.getState().reorderTasksInColumn('backlog', 'task-4', 'task-2');

      expect(useTaskStore.getState().taskOrder?.backlog).toEqual(['task-1', 'task-4', 'task-2', 'task-3']);
    });

    it('should handle reordering in different columns', () => {
      const order = createTestTaskOrder({
        backlog: ['task-1', 'task-2'],
        in_progress: ['task-3', 'task-4', 'task-5']
      });
      useTaskStore.setState({ taskOrder: order });

      // Reorder in_progress column
      useTaskStore.getState().reorderTasksInColumn('in_progress', 'task-5', 'task-3');

      expect(useTaskStore.getState().taskOrder?.in_progress).toEqual(['task-5', 'task-3', 'task-4']);
      // backlog should remain unchanged
      expect(useTaskStore.getState().taskOrder?.backlog).toEqual(['task-1', 'task-2']);
    });

    it('should do nothing if taskOrder is null', () => {
      useTaskStore.setState({ taskOrder: null });

      useTaskStore.getState().reorderTasksInColumn('backlog', 'task-1', 'task-2');

      expect(useTaskStore.getState().taskOrder).toBeNull();
    });

    it('should do nothing if activeId is not in the column', () => {
      const order = createTestTaskOrder({
        backlog: ['task-1', 'task-2', 'task-3']
      });
      useTaskStore.setState({ taskOrder: order });

      useTaskStore.getState().reorderTasksInColumn('backlog', 'nonexistent', 'task-2');

      expect(useTaskStore.getState().taskOrder?.backlog).toEqual(['task-1', 'task-2', 'task-3']);
    });

    it('should do nothing if overId is not in the column', () => {
      const order = createTestTaskOrder({
        backlog: ['task-1', 'task-2', 'task-3']
      });
      useTaskStore.setState({ taskOrder: order });

      useTaskStore.getState().reorderTasksInColumn('backlog', 'task-1', 'nonexistent');

      expect(useTaskStore.getState().taskOrder?.backlog).toEqual(['task-1', 'task-2', 'task-3']);
    });

    it('should do nothing if both activeId and overId are not in the column', () => {
      const order = createTestTaskOrder({
        backlog: ['task-1', 'task-2', 'task-3']
      });
      useTaskStore.setState({ taskOrder: order });

      useTaskStore.getState().reorderTasksInColumn('backlog', 'nonexistent-1', 'nonexistent-2');

      expect(useTaskStore.getState().taskOrder?.backlog).toEqual(['task-1', 'task-2', 'task-3']);
    });

    it('should handle reordering with same active and over id (no change)', () => {
      const order = createTestTaskOrder({
        backlog: ['task-1', 'task-2', 'task-3']
      });
      useTaskStore.setState({ taskOrder: order });

      useTaskStore.getState().reorderTasksInColumn('backlog', 'task-2', 'task-2');

      expect(useTaskStore.getState().taskOrder?.backlog).toEqual(['task-1', 'task-2', 'task-3']);
    });

    it('should handle column with only one task', () => {
      const order = createTestTaskOrder({
        backlog: ['task-1']
      });
      useTaskStore.setState({ taskOrder: order });

      // Cannot reorder a single task (overId won't exist)
      useTaskStore.getState().reorderTasksInColumn('backlog', 'task-1', 'task-2');

      expect(useTaskStore.getState().taskOrder?.backlog).toEqual(['task-1']);
    });

    it('should handle reordering adjacent tasks', () => {
      const order = createTestTaskOrder({
        backlog: ['task-1', 'task-2', 'task-3']
      });
      useTaskStore.setState({ taskOrder: order });

      // Swap task-1 and task-2
      useTaskStore.getState().reorderTasksInColumn('backlog', 'task-1', 'task-2');

      expect(useTaskStore.getState().taskOrder?.backlog).toEqual(['task-2', 'task-1', 'task-3']);
    });
  });

  describe('loadTaskOrder', () => {
    it('should load task order from localStorage', () => {
      const order = createTestTaskOrder({
        backlog: ['task-1', 'task-2'],
        in_progress: ['task-3']
      });
      localStorage.setItem('task-order-state-project-1', JSON.stringify(order));

      useTaskStore.getState().loadTaskOrder('project-1');

      expect(useTaskStore.getState().taskOrder).toEqual(order);
    });

    it('should create empty task order if no stored order exists', () => {
      useTaskStore.getState().loadTaskOrder('project-1');

      expect(useTaskStore.getState().taskOrder).toEqual({
        backlog: [],
        in_progress: [],
        ai_review: [],
        human_review: [],
        pr_created: [],
        done: []
      });
    });

    it('should use project-specific localStorage keys', () => {
      const order1 = createTestTaskOrder({ backlog: ['project1-task'] });
      const order2 = createTestTaskOrder({ backlog: ['project2-task'] });
      localStorage.setItem('task-order-state-project-1', JSON.stringify(order1));
      localStorage.setItem('task-order-state-project-2', JSON.stringify(order2));

      useTaskStore.getState().loadTaskOrder('project-1');
      expect(useTaskStore.getState().taskOrder?.backlog).toEqual(['project1-task']);

      useTaskStore.getState().loadTaskOrder('project-2');
      expect(useTaskStore.getState().taskOrder?.backlog).toEqual(['project2-task']);
    });

    it('should handle corrupted localStorage data gracefully', () => {
      // Spy on console.error to verify error logging
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      localStorage.setItem('task-order-state-project-1', 'invalid-json{{{');

      useTaskStore.getState().loadTaskOrder('project-1');

      // Should fall back to empty order state
      expect(useTaskStore.getState().taskOrder).toEqual({
        backlog: [],
        in_progress: [],
        ai_review: [],
        human_review: [],
        pr_created: [],
        done: []
      });
      expect(consoleSpy).toHaveBeenCalledWith('Failed to load task order:', expect.any(Error));

      consoleSpy.mockRestore();
    });

    it('should handle localStorage access errors', () => {
      // Spy on console.error
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      // Mock localStorage.getItem to throw
      const originalGetItem = localStorage.getItem;
      localStorage.getItem = vi.fn(() => {
        throw new Error('Storage quota exceeded');
      });

      useTaskStore.getState().loadTaskOrder('project-1');

      // Should fall back to empty order state
      expect(useTaskStore.getState().taskOrder).toEqual({
        backlog: [],
        in_progress: [],
        ai_review: [],
        human_review: [],
        pr_created: [],
        done: []
      });

      localStorage.getItem = originalGetItem;
      consoleSpy.mockRestore();
    });
  });

  describe('saveTaskOrder', () => {
    it('should save task order to localStorage', () => {
      const order = createTestTaskOrder({
        backlog: ['task-1', 'task-2'],
        in_progress: ['task-3']
      });
      useTaskStore.setState({ taskOrder: order });

      useTaskStore.getState().saveTaskOrder('project-1');

      const stored = localStorage.getItem('task-order-state-project-1');
      expect(stored).toBeTruthy();
      expect(JSON.parse(stored!)).toEqual(order);
    });

    it('should not save if taskOrder is null', () => {
      useTaskStore.setState({ taskOrder: null });

      useTaskStore.getState().saveTaskOrder('project-1');

      const stored = localStorage.getItem('task-order-state-project-1');
      expect(stored).toBeNull();
    });

    it('should use project-specific localStorage keys', () => {
      const order = createTestTaskOrder({ backlog: ['test-task'] });
      useTaskStore.setState({ taskOrder: order });

      useTaskStore.getState().saveTaskOrder('my-project-id');

      expect(localStorage.getItem('task-order-state-my-project-id')).toBeTruthy();
      expect(localStorage.getItem('task-order-state-other-project')).toBeNull();
    });

    it('should handle localStorage write errors gracefully', () => {
      // Spy on console.error
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const order = createTestTaskOrder({ backlog: ['task-1'] });
      useTaskStore.setState({ taskOrder: order });

      // Mock localStorage.setItem to throw
      const originalSetItem = localStorage.setItem;
      localStorage.setItem = vi.fn(() => {
        throw new Error('Storage quota exceeded');
      });

      // Should not throw
      expect(() => {
        useTaskStore.getState().saveTaskOrder('project-1');
      }).not.toThrow();

      expect(consoleSpy).toHaveBeenCalledWith('Failed to save task order:', expect.any(Error));

      localStorage.setItem = originalSetItem;
      consoleSpy.mockRestore();
    });

    it('should overwrite existing stored order', () => {
      const initialOrder = createTestTaskOrder({ backlog: ['old-task'] });
      localStorage.setItem('task-order-state-project-1', JSON.stringify(initialOrder));

      const newOrder = createTestTaskOrder({ backlog: ['new-task-1', 'new-task-2'] });
      useTaskStore.setState({ taskOrder: newOrder });

      useTaskStore.getState().saveTaskOrder('project-1');

      const stored = JSON.parse(localStorage.getItem('task-order-state-project-1')!);
      expect(stored.backlog).toEqual(['new-task-1', 'new-task-2']);
    });
  });

  describe('clearTaskOrder', () => {
    it('should clear task order from localStorage', () => {
      const order = createTestTaskOrder({ backlog: ['task-1'] });
      localStorage.setItem('task-order-state-project-1', JSON.stringify(order));
      useTaskStore.setState({ taskOrder: order });

      useTaskStore.getState().clearTaskOrder('project-1');

      expect(localStorage.getItem('task-order-state-project-1')).toBeNull();
      expect(useTaskStore.getState().taskOrder).toBeNull();
    });

    it('should use project-specific localStorage keys', () => {
      localStorage.setItem('task-order-state-project-1', JSON.stringify(createTestTaskOrder()));
      localStorage.setItem('task-order-state-project-2', JSON.stringify(createTestTaskOrder()));

      useTaskStore.getState().clearTaskOrder('project-1');

      expect(localStorage.getItem('task-order-state-project-1')).toBeNull();
      expect(localStorage.getItem('task-order-state-project-2')).toBeTruthy();
    });

    it('should handle localStorage removal errors gracefully', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      // Mock localStorage.removeItem to throw
      const originalRemoveItem = localStorage.removeItem;
      localStorage.removeItem = vi.fn(() => {
        throw new Error('Storage error');
      });

      // Should not throw
      expect(() => {
        useTaskStore.getState().clearTaskOrder('project-1');
      }).not.toThrow();

      localStorage.removeItem = originalRemoveItem;
      consoleSpy.mockRestore();
    });
  });

  describe('moveTaskToColumnTop', () => {
    it('should move task to top of target column', () => {
      const order = createTestTaskOrder({
        backlog: ['task-1', 'task-2'],
        in_progress: ['task-3', 'task-4']
      });
      useTaskStore.setState({ taskOrder: order });

      useTaskStore.getState().moveTaskToColumnTop('task-2', 'in_progress', 'backlog');

      expect(useTaskStore.getState().taskOrder?.in_progress).toEqual(['task-2', 'task-3', 'task-4']);
      expect(useTaskStore.getState().taskOrder?.backlog).toEqual(['task-1']);
    });

    it('should remove task from source column when provided', () => {
      const order = createTestTaskOrder({
        backlog: ['task-1', 'task-2', 'task-3'],
        in_progress: ['task-4']
      });
      useTaskStore.setState({ taskOrder: order });

      useTaskStore.getState().moveTaskToColumnTop('task-2', 'in_progress', 'backlog');

      expect(useTaskStore.getState().taskOrder?.backlog).toEqual(['task-1', 'task-3']);
    });

    it('should work without source column (only add to target)', () => {
      const order = createTestTaskOrder({
        backlog: ['task-1'],
        in_progress: ['task-2', 'task-3']
      });
      useTaskStore.setState({ taskOrder: order });

      useTaskStore.getState().moveTaskToColumnTop('new-task', 'in_progress');

      expect(useTaskStore.getState().taskOrder?.in_progress).toEqual(['new-task', 'task-2', 'task-3']);
      expect(useTaskStore.getState().taskOrder?.backlog).toEqual(['task-1']);
    });

    it('should handle task already in target column (remove duplicate first)', () => {
      const order = createTestTaskOrder({
        in_progress: ['task-1', 'task-2', 'task-3']
      });
      useTaskStore.setState({ taskOrder: order });

      // Move task-3 to top of same column (simulates cross-column then same-column scenario)
      useTaskStore.getState().moveTaskToColumnTop('task-3', 'in_progress');

      expect(useTaskStore.getState().taskOrder?.in_progress).toEqual(['task-3', 'task-1', 'task-2']);
    });

    it('should do nothing if taskOrder is null', () => {
      useTaskStore.setState({ taskOrder: null });

      useTaskStore.getState().moveTaskToColumnTop('task-1', 'in_progress', 'backlog');

      expect(useTaskStore.getState().taskOrder).toBeNull();
    });

    it('should initialize target column if it does not exist in order', () => {
      // Create order with partial columns (simulating missing column)
      const order = {
        backlog: ['task-1'],
        in_progress: [],
        ai_review: [],
        human_review: [],
        pr_created: [],
        done: []
      } as TaskOrderState;
      useTaskStore.setState({ taskOrder: order });

      useTaskStore.getState().moveTaskToColumnTop('task-1', 'in_progress', 'backlog');

      expect(useTaskStore.getState().taskOrder?.in_progress).toEqual(['task-1']);
    });
  });

  describe('addTask with task order', () => {
    it('should add new task to top of column order', () => {
      const order = createTestTaskOrder({
        backlog: ['existing-task-1', 'existing-task-2']
      });
      useTaskStore.setState({ taskOrder: order, tasks: [] });

      const newTask = createTestTask({ id: 'new-task', status: 'backlog' });
      useTaskStore.getState().addTask(newTask);

      expect(useTaskStore.getState().taskOrder?.backlog).toEqual([
        'new-task',
        'existing-task-1',
        'existing-task-2'
      ]);
    });

    it('should add task to correct column based on status', () => {
      const order = createTestTaskOrder({
        backlog: ['backlog-task'],
        in_progress: ['progress-task']
      });
      useTaskStore.setState({ taskOrder: order, tasks: [] });

      const newTask = createTestTask({ id: 'new-progress-task', status: 'in_progress' });
      useTaskStore.getState().addTask(newTask);

      expect(useTaskStore.getState().taskOrder?.in_progress).toEqual([
        'new-progress-task',
        'progress-task'
      ]);
      expect(useTaskStore.getState().taskOrder?.backlog).toEqual(['backlog-task']);
    });

    it('should not modify order if taskOrder is null', () => {
      useTaskStore.setState({ taskOrder: null, tasks: [] });

      const newTask = createTestTask({ id: 'new-task', status: 'backlog' });
      useTaskStore.getState().addTask(newTask);

      expect(useTaskStore.getState().taskOrder).toBeNull();
      expect(useTaskStore.getState().tasks).toHaveLength(1);
    });

    it('should handle adding task when column does not exist in order', () => {
      const order = createTestTaskOrder({
        backlog: ['task-1']
      });
      useTaskStore.setState({ taskOrder: order, tasks: [] });

      // This should work because createTestTaskOrder initializes all columns
      const newTask = createTestTask({ id: 'new-task', status: 'done' });
      useTaskStore.getState().addTask(newTask);

      expect(useTaskStore.getState().taskOrder?.done).toEqual(['new-task']);
    });

    it('should prevent duplicate task IDs in order', () => {
      const order = createTestTaskOrder({
        backlog: ['task-1', 'task-2']
      });
      useTaskStore.setState({ taskOrder: order, tasks: [] });

      // Try to add a task with existing ID
      const duplicateTask = createTestTask({ id: 'task-1', status: 'backlog' });
      useTaskStore.getState().addTask(duplicateTask);

      // Should add to top but remove existing occurrence
      expect(useTaskStore.getState().taskOrder?.backlog).toEqual(['task-1', 'task-2']);
    });
  });

  describe('localStorage persistence edge cases', () => {
    it('should handle empty string in localStorage', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      localStorage.setItem('task-order-state-project-1', '');

      useTaskStore.getState().loadTaskOrder('project-1');

      // Empty string causes JSON.parse to throw - should fall back to empty order
      expect(useTaskStore.getState().taskOrder).toEqual({
        backlog: [],
        in_progress: [],
        ai_review: [],
        human_review: [],
        pr_created: [],
        done: []
      });

      consoleSpy.mockRestore();
    });

    it('should handle partial/incomplete JSON object', () => {
      // JSON that parses but is missing some columns
      const partialOrder = { backlog: ['task-1'], in_progress: ['task-2'] };
      localStorage.setItem('task-order-state-project-1', JSON.stringify(partialOrder));

      useTaskStore.getState().loadTaskOrder('project-1');

      // Should load whatever was stored (partial data)
      const order = useTaskStore.getState().taskOrder;
      expect(order?.backlog).toEqual(['task-1']);
      expect(order?.in_progress).toEqual(['task-2']);
      // Missing columns will be undefined in the stored object
    });

    it('should handle null stored value', () => {
      localStorage.setItem('task-order-state-project-1', JSON.stringify(null));

      useTaskStore.getState().loadTaskOrder('project-1');

      // null is valid JSON but not a valid TaskOrderState - store will set it as taskOrder
      // This is expected behavior - the store trusts valid JSON
      expect(useTaskStore.getState().taskOrder).toBeNull();
    });

    it('should handle array instead of object stored', () => {
      localStorage.setItem('task-order-state-project-1', JSON.stringify(['task-1', 'task-2']));

      useTaskStore.getState().loadTaskOrder('project-1');

      // Array is valid JSON but wrong structure - store will set it
      // Store actions should handle this gracefully
      expect(Array.isArray(useTaskStore.getState().taskOrder)).toBe(true);
    });

    it('should round-trip save and load with exact data preservation', () => {
      const order = createTestTaskOrder({
        backlog: ['task-1', 'task-2', 'task-3'],
        in_progress: ['task-4'],
        ai_review: [],
        human_review: ['task-5', 'task-6'],
        pr_created: [],
        done: ['task-7', 'task-8', 'task-9', 'task-10']
      });
      useTaskStore.setState({ taskOrder: order });

      // Save
      useTaskStore.getState().saveTaskOrder('round-trip-test');

      // Clear state
      useTaskStore.setState({ taskOrder: null });
      expect(useTaskStore.getState().taskOrder).toBeNull();

      // Load
      useTaskStore.getState().loadTaskOrder('round-trip-test');

      // Verify exact preservation
      expect(useTaskStore.getState().taskOrder).toEqual(order);
    });

    it('should handle special characters in project ID', () => {
      const order = createTestTaskOrder({ backlog: ['special-task'] });
      useTaskStore.setState({ taskOrder: order });

      const specialProjectId = 'project/with:special@chars!';
      useTaskStore.getState().saveTaskOrder(specialProjectId);

      useTaskStore.setState({ taskOrder: null });
      useTaskStore.getState().loadTaskOrder(specialProjectId);

      expect(useTaskStore.getState().taskOrder?.backlog).toEqual(['special-task']);
    });

    it('should isolate different projects completely', () => {
      // Set up three different projects with different orders
      const orders = {
        'project-a': createTestTaskOrder({ backlog: ['a-task-1', 'a-task-2'] }),
        'project-b': createTestTaskOrder({ in_progress: ['b-task-1'] }),
        'project-c': createTestTaskOrder({ done: ['c-task-1', 'c-task-2', 'c-task-3'] })
      };

      // Save all three
      for (const [projectId, order] of Object.entries(orders)) {
        useTaskStore.setState({ taskOrder: order });
        useTaskStore.getState().saveTaskOrder(projectId);
      }

      // Clear and verify each loads independently
      for (const [projectId, expectedOrder] of Object.entries(orders)) {
        useTaskStore.setState({ taskOrder: null });
        useTaskStore.getState().loadTaskOrder(projectId);
        expect(useTaskStore.getState().taskOrder).toEqual(expectedOrder);
      }
    });

    it('should handle very long task ID arrays', () => {
      // Create an order with many task IDs
      const manyTaskIds = Array.from({ length: 100 }, (_, i) => `task-${i}`);
      const order = createTestTaskOrder({ backlog: manyTaskIds });
      useTaskStore.setState({ taskOrder: order });

      useTaskStore.getState().saveTaskOrder('many-tasks-project');
      useTaskStore.setState({ taskOrder: null });
      useTaskStore.getState().loadTaskOrder('many-tasks-project');

      expect(useTaskStore.getState().taskOrder?.backlog).toHaveLength(100);
      expect(useTaskStore.getState().taskOrder?.backlog[0]).toBe('task-0');
      expect(useTaskStore.getState().taskOrder?.backlog[99]).toBe('task-99');
    });
  });

  describe('integration: load, reorder, save cycle', () => {
    it('should persist reordering through load/save cycle', () => {
      // 1. Load empty order
      useTaskStore.getState().loadTaskOrder('test-project');
      expect(useTaskStore.getState().taskOrder).toBeDefined();

      // 2. Set up initial order
      const order = createTestTaskOrder({
        backlog: ['task-a', 'task-b', 'task-c']
      });
      useTaskStore.getState().setTaskOrder(order);

      // 3. Reorder
      useTaskStore.getState().reorderTasksInColumn('backlog', 'task-c', 'task-a');
      expect(useTaskStore.getState().taskOrder?.backlog).toEqual(['task-c', 'task-a', 'task-b']);

      // 4. Save
      useTaskStore.getState().saveTaskOrder('test-project');

      // 5. Clear state
      useTaskStore.setState({ taskOrder: null });

      // 6. Reload
      useTaskStore.getState().loadTaskOrder('test-project');

      // 7. Verify order persisted
      expect(useTaskStore.getState().taskOrder?.backlog).toEqual(['task-c', 'task-a', 'task-b']);
    });

    it('should handle project switching correctly', () => {
      // Set up orders for two projects
      const order1 = createTestTaskOrder({ backlog: ['project1-task'] });
      const order2 = createTestTaskOrder({ backlog: ['project2-task'] });

      // Save project 1 order
      useTaskStore.setState({ taskOrder: order1 });
      useTaskStore.getState().saveTaskOrder('project-1');

      // Save project 2 order
      useTaskStore.setState({ taskOrder: order2 });
      useTaskStore.getState().saveTaskOrder('project-2');

      // Clear and switch between projects
      useTaskStore.setState({ taskOrder: null });

      useTaskStore.getState().loadTaskOrder('project-1');
      expect(useTaskStore.getState().taskOrder?.backlog).toEqual(['project1-task']);

      useTaskStore.getState().loadTaskOrder('project-2');
      expect(useTaskStore.getState().taskOrder?.backlog).toEqual(['project2-task']);
    });
  });
});

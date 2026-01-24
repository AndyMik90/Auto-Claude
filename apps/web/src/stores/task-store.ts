import { create } from 'zustand';
import { arrayMove } from '@dnd-kit/sortable';
import type {
  Task,
  TaskStatus,
  SubtaskStatus,
  ImplementationPlan,
  Subtask,
  TaskMetadata,
  ExecutionProgress,
  ExecutionPhase,
  ReviewReason,
  TaskDraft,
  ImageAttachment,
  TaskOrderState
} from '../types';
import { ipc } from '../lib/ipc-abstraction';

interface TaskState {
  tasks: Task[];
  selectedTaskId: string | null;
  isLoading: boolean;
  error: string | null;
  taskOrder: TaskOrderState | null; // Per-column task ordering for kanban board

  // Actions
  setTasks: (tasks: Task[]) => void;
  addTask: (task: Task) => void;
  updateTask: (taskId: string, updates: Partial<Task>) => void;
  updateTaskStatus: (taskId: string, status: TaskStatus) => void;
  updateTaskFromPlan: (taskId: string, plan: ImplementationPlan) => void;
  updateExecutionProgress: (taskId: string, progress: Partial<ExecutionProgress>) => void;
  appendLog: (taskId: string, log: string) => void;
  batchAppendLogs: (taskId: string, logs: string[]) => void;
  selectTask: (taskId: string | null) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  clearTasks: () => void;
  // Task order actions for kanban drag-and-drop reordering
  setTaskOrder: (order: TaskOrderState) => void;
  reorderTasksInColumn: (status: TaskStatus, activeId: string, overId: string) => void;
  moveTaskToColumnTop: (taskId: string, targetStatus: TaskStatus, sourceStatus?: TaskStatus) => void;
  loadTaskOrder: (projectId: string) => void;
  saveTaskOrder: (projectId: string) => boolean;
  clearTaskOrder: (projectId: string) => void;

  // Task status change listeners (for queue auto-promotion)
  registerTaskStatusChangeListener: (
    listener: (taskId: string, oldStatus: TaskStatus | undefined, newStatus: TaskStatus) => void
  ) => () => void;

  // Selectors
  getSelectedTask: () => Task | undefined;
  getTasksByStatus: (status: TaskStatus) => Task[];
}

/**
 * Helper to find task index by id or specId.
 * Returns -1 if not found.
 */
function findTaskIndex(tasks: Task[], taskId: string): number {
  return tasks.findIndex((t) => t.id === taskId || t.specId === taskId);
}

/**
 * Task status change listeners for queue auto-promotion
 * Stored outside the store to avoid triggering re-renders
 */
const taskStatusChangeListeners = new Set<
  (taskId: string, oldStatus: TaskStatus | undefined, newStatus: TaskStatus) => void
>();

/**
 * Notify all registered listeners when a task status changes
 */
function notifyTaskStatusChange(
  taskId: string,
  oldStatus: TaskStatus | undefined,
  newStatus: TaskStatus
): void {
  for (const listener of taskStatusChangeListeners) {
    try {
      listener(taskId, oldStatus, newStatus);
    } catch (error) {
      console.error('[TaskStore] Error in task status change listener:', error);
    }
  }
}

/**
 * Helper to update a single task efficiently.
 * Uses slice instead of map to avoid iterating all tasks.
 */
function updateTaskAtIndex(tasks: Task[], index: number, updater: (task: Task) => Task): Task[] {
  if (index < 0 || index >= tasks.length) return tasks;

  const updatedTask = updater(tasks[index]);

  // If the task reference didn't change, return original array
  if (updatedTask === tasks[index]) {
    return tasks;
  }

  // Create new array with only the changed task replaced
  const newTasks = [...tasks];
  newTasks[index] = updatedTask;

  return newTasks;
}

/**
 * Validates implementation plan data structure before processing.
 * Returns true if valid, false if invalid/incomplete.
 */
function validatePlanData(plan: ImplementationPlan): boolean {
  // Validate plan has phases array
  if (!plan.phases || !Array.isArray(plan.phases)) {
    console.warn('[validatePlanData] Invalid plan: missing or invalid phases array');
    return false;
  }

  // Validate each phase has subtasks array
  for (let i = 0; i < plan.phases.length; i++) {
    const phase = plan.phases[i];
    if (!phase || !phase.subtasks || !Array.isArray(phase.subtasks)) {
      console.warn(`[validatePlanData] Invalid phase ${i}: missing or invalid subtasks array`);
      return false;
    }

    // Validate each subtask has at minimum a description
    for (let j = 0; j < phase.subtasks.length; j++) {
      const subtask = phase.subtasks[j];
      if (!subtask || typeof subtask !== 'object') {
        console.warn(`[validatePlanData] Invalid subtask at phase ${i}, index ${j}: not an object`);
        return false;
      }

      // Description is critical - we can't show a subtask without it
      if (!subtask.description || typeof subtask.description !== 'string' || subtask.description.trim() === '') {
        console.warn(`[validatePlanData] Invalid subtask at phase ${i}, index ${j}: missing or empty description`);
        return false;
      }
    }
  }

  return true;
}

// localStorage key prefix for task order persistence
const TASK_ORDER_KEY_PREFIX = 'task-order-state';

/**
 * Get the localStorage key for a project's task order
 */
function getTaskOrderKey(projectId: string): string {
  return `${TASK_ORDER_KEY_PREFIX}-${projectId}`;
}

/**
 * Create an empty task order state with all status columns
 */
function createEmptyTaskOrder(): TaskOrderState {
  return {
    backlog: [],
    queue: [],
    in_progress: [],
    ai_review: [],
    human_review: [],
    done: [],
    pr_created: [],
    error: []
  };
}

export const useTaskStore = create<TaskState>((set, get) => ({
  tasks: [],
  selectedTaskId: null,
  isLoading: false,
  error: null,
  taskOrder: null,

  setTasks: (tasks) => set({ tasks }),

  addTask: (task) =>
    set((state) => {
      // Determine which column the task belongs to based on its status
      const status = task.status || 'backlog';

      // Update task order if it exists - new tasks go to top of their column
      let taskOrder = state.taskOrder;
      if (taskOrder) {
        const newTaskOrder = { ...taskOrder };

        // Add task ID to the top of the appropriate column
        if (newTaskOrder[status]) {
          // Ensure the task isn't already in the array (safety check)
          newTaskOrder[status] = newTaskOrder[status].filter((id) => id !== task.id);
          // Add to top (index 0)
          newTaskOrder[status] = [task.id, ...newTaskOrder[status]];
        } else {
          // Initialize column order array if it doesn't exist
          newTaskOrder[status] = [task.id];
        }

        taskOrder = newTaskOrder;
      }

      return {
        tasks: [...state.tasks, task],
        taskOrder
      };
    }),

  updateTask: (taskId, updates) =>
    set((state) => {
      const index = findTaskIndex(state.tasks, taskId);
      if (index === -1) return state;

      return {
        tasks: updateTaskAtIndex(state.tasks, index, (t) => ({ ...t, ...updates }))
      };
    }),

  updateTaskStatus: (taskId, status) =>
    set((state) => {
      const index = findTaskIndex(state.tasks, taskId);
      if (index === -1) return state;

      const oldTask = state.tasks[index];
      const oldStatus = oldTask.status;

      // Check if status actually changed
      if (oldStatus === status) return state;

      // Notify listeners of status change
      notifyTaskStatusChange(taskId, oldStatus, status);

      // Update task status
      const newTasks = updateTaskAtIndex(state.tasks, index, (t) => ({ ...t, status }));

      // Update task order - move task from old column to new column
      let taskOrder = state.taskOrder;
      if (taskOrder) {
        const newTaskOrder = { ...taskOrder };

        // Remove from old column
        if (oldStatus && newTaskOrder[oldStatus]) {
          newTaskOrder[oldStatus] = newTaskOrder[oldStatus].filter((id) => id !== taskId);
        }

        // Add to top of new column
        if (newTaskOrder[status]) {
          // Ensure the task isn't already in the array (safety check)
          newTaskOrder[status] = newTaskOrder[status].filter((id) => id !== taskId);
          // Add to top (index 0)
          newTaskOrder[status] = [taskId, ...newTaskOrder[status]];
        } else {
          // Initialize column order array if it doesn't exist
          newTaskOrder[status] = [taskId];
        }

        taskOrder = newTaskOrder;
      }

      return {
        tasks: newTasks,
        taskOrder
      };
    }),

  updateTaskFromPlan: (taskId, plan) =>
    set((state) => {
      const index = findTaskIndex(state.tasks, taskId);
      if (index === -1) {
        console.warn(`[TaskStore] Cannot update task from plan: task ${taskId} not found`);
        return state;
      }

      // Validate plan data structure
      if (!validatePlanData(plan)) {
        console.error('[TaskStore] Invalid plan data structure, skipping update');
        return state;
      }

      // Count total subtasks across all phases
      const totalSubtasks = plan.phases.reduce((sum, phase) => sum + (phase.subtasks?.length || 0), 0);

      // Count completed subtasks
      const completedSubtasks = plan.phases.reduce((sum, phase) => {
        return sum + (phase.subtasks?.filter((st) => st.status === 'completed').length || 0);
      }, 0);

      // Update task with plan and execution progress
      return {
        tasks: updateTaskAtIndex(state.tasks, index, (t) => ({
          ...t,
          plan,
          progress: {
            ...t.progress,
            totalSubtasks,
            completedSubtasks,
            phase: t.progress?.phase || 'planning'
          }
        }))
      };
    }),

  updateExecutionProgress: (taskId, progress) =>
    set((state) => {
      const index = findTaskIndex(state.tasks, taskId);
      if (index === -1) return state;

      return {
        tasks: updateTaskAtIndex(state.tasks, index, (t) => ({
          ...t,
          progress: {
            ...t.progress,
            ...progress
          } as ExecutionProgress
        }))
      };
    }),

  appendLog: (taskId, log) =>
    set((state) => {
      const index = findTaskIndex(state.tasks, taskId);
      if (index === -1) return state;

      return {
        tasks: updateTaskAtIndex(state.tasks, index, (t) => {
          const currentLogs = t.progress?.logs || [];
          return {
            ...t,
            progress: {
              ...t.progress,
              logs: [...currentLogs, log]
            } as ExecutionProgress
          };
        })
      };
    }),

  batchAppendLogs: (taskId, logs) =>
    set((state) => {
      const index = findTaskIndex(state.tasks, taskId);
      if (index === -1) return state;

      return {
        tasks: updateTaskAtIndex(state.tasks, index, (t) => {
          const currentLogs = t.progress?.logs || [];
          return {
            ...t,
            progress: {
              ...t.progress,
              logs: [...currentLogs, ...logs]
            } as ExecutionProgress
          };
        })
      };
    }),

  selectTask: (taskId) => set({ selectedTaskId: taskId }),

  setLoading: (isLoading) => set({ isLoading }),

  setError: (error) => set({ error }),

  clearTasks: () =>
    set({
      tasks: [],
      selectedTaskId: null,
      taskOrder: null
    }),

  // Task order management
  setTaskOrder: (order) => set({ taskOrder: order }),

  reorderTasksInColumn: (status, activeId, overId) =>
    set((state) => {
      if (!state.taskOrder || !state.taskOrder[status]) return state;

      const columnOrder = state.taskOrder[status];
      const oldIndex = columnOrder.indexOf(activeId);
      const newIndex = columnOrder.indexOf(overId);

      if (oldIndex === -1 || newIndex === -1) {
        console.warn(`[TaskStore] Cannot reorder: task not found in column ${status}`);
        return state;
      }

      const newOrder = arrayMove(columnOrder, oldIndex, newIndex);

      return {
        taskOrder: {
          ...state.taskOrder,
          [status]: newOrder
        }
      };
    }),

  moveTaskToColumnTop: (taskId, targetStatus, sourceStatus) =>
    set((state) => {
      if (!state.taskOrder) return state;

      const newTaskOrder = { ...state.taskOrder };

      // Remove from source column if specified
      if (sourceStatus && newTaskOrder[sourceStatus]) {
        newTaskOrder[sourceStatus] = newTaskOrder[sourceStatus].filter((id) => id !== taskId);
      }

      // Add to top of target column
      if (newTaskOrder[targetStatus]) {
        // Remove from target column if already present (for idempotency)
        newTaskOrder[targetStatus] = newTaskOrder[targetStatus].filter((id) => id !== taskId);
        // Add to top
        newTaskOrder[targetStatus] = [taskId, ...newTaskOrder[targetStatus]];
      } else {
        // Initialize column if it doesn't exist
        newTaskOrder[targetStatus] = [taskId];
      }

      return { taskOrder: newTaskOrder };
    }),

  loadTaskOrder: (projectId) => {
    try {
      const key = getTaskOrderKey(projectId);
      const stored = localStorage.getItem(key);

      if (stored) {
        const taskOrder = JSON.parse(stored) as TaskOrderState;
        set({ taskOrder });
        console.log(`[TaskStore] Loaded task order for project: ${projectId}`);
      } else {
        // Initialize empty order
        set({ taskOrder: createEmptyTaskOrder() });
      }
    } catch (error) {
      console.error('[TaskStore] Error loading task order:', error);
      set({ taskOrder: createEmptyTaskOrder() });
    }
  },

  saveTaskOrder: (projectId) => {
    try {
      const { taskOrder } = get();
      if (!taskOrder) {
        console.warn('[TaskStore] No task order to save');
        return false;
      }

      const key = getTaskOrderKey(projectId);
      localStorage.setItem(key, JSON.stringify(taskOrder));
      console.log(`[TaskStore] Saved task order for project: ${projectId}`);
      return true;
    } catch (error) {
      console.error('[TaskStore] Error saving task order:', error);
      return false;
    }
  },

  clearTaskOrder: (projectId) => {
    try {
      const key = getTaskOrderKey(projectId);
      localStorage.removeItem(key);
      set({ taskOrder: null });
      console.log(`[TaskStore] Cleared task order for project: ${projectId}`);
    } catch (error) {
      console.error('[TaskStore] Error clearing task order:', error);
    }
  },

  // Task status change listener management
  registerTaskStatusChangeListener: (listener) => {
    taskStatusChangeListeners.add(listener);

    // Return unsubscribe function
    return () => {
      taskStatusChangeListeners.delete(listener);
    };
  },

  // Selectors
  getSelectedTask: () => {
    const state = get();
    return state.tasks.find((t) => t.id === state.selectedTaskId);
  },

  getTasksByStatus: (status) => {
    const state = get();
    const tasksForStatus = state.tasks.filter((t) => t.status === status);

    // Sort by task order if available
    if (state.taskOrder && state.taskOrder[status]) {
      const orderMap = new Map(state.taskOrder[status].map((id, index) => [id, index]));

      return tasksForStatus.sort((a, b) => {
        const aOrder = orderMap.get(a.id) ?? Number.MAX_SAFE_INTEGER;
        const bOrder = orderMap.get(b.id) ?? Number.MAX_SAFE_INTEGER;
        return aOrder - bOrder;
      });
    }

    return tasksForStatus;
  }
}));

// Set up IPC listeners for task updates from backend
// This allows the backend to push updates to the store
if (typeof window !== 'undefined') {
  ipc.on('task-created', (data: Task) => {
    useTaskStore.getState().addTask(data);
  });

  ipc.on('task-updated', (data: { taskId: string; updates: Partial<Task> }) => {
    useTaskStore.getState().updateTask(data.taskId, data.updates);
  });

  ipc.on('task-status-changed', (data: { taskId: string; status: TaskStatus }) => {
    useTaskStore.getState().updateTaskStatus(data.taskId, data.status);
  });

  ipc.on('task-plan-updated', (data: { taskId: string; plan: ImplementationPlan }) => {
    useTaskStore.getState().updateTaskFromPlan(data.taskId, data.plan);
  });

  ipc.on('task-progress-updated', (data: { taskId: string; progress: Partial<ExecutionProgress> }) => {
    useTaskStore.getState().updateExecutionProgress(data.taskId, data.progress);
  });

  ipc.on('task-log-appended', (data: { taskId: string; log: string }) => {
    useTaskStore.getState().appendLog(data.taskId, data.log);
  });

  ipc.on('tasks-loaded', (data: Task[]) => {
    useTaskStore.getState().setTasks(data);
  });
}

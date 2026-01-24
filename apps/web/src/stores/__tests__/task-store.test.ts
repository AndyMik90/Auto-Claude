import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useTaskStore } from '../task-store';

describe('TaskStore', () => {
  beforeEach(() => {
    // Reset store before each test
    useTaskStore.setState({ tasks: [] });
  });

  it('should add task', () => {
    const store = useTaskStore.getState();

    store.addTask({
      id: '1',
      title: 'Test Task',
      status: 'todo',
      priority: 'medium',
      description: '',
    });

    const tasks = useTaskStore.getState().tasks;
    expect(tasks).toHaveLength(1);
    expect(tasks[0].id).toBe('1');
  });

  it('should update task', () => {
    const store = useTaskStore.getState();

    store.addTask({ id: '1', title: 'Original', status: 'todo', priority: 'low', description: '' });
    store.updateTask('1', { title: 'Updated' });

    const task = useTaskStore.getState().tasks[0];
    expect(task.title).toBe('Updated');
  });

  it('should delete task', () => {
    const store = useTaskStore.getState();

    store.addTask({ id: '1', title: 'Test', status: 'todo', priority: 'low', description: '' });
    store.deleteTask('1');

    const tasks = useTaskStore.getState().tasks;
    expect(tasks).toHaveLength(0);
  });

  it('should update task status', () => {
    const store = useTaskStore.getState();

    store.addTask({ id: '1', title: 'Test', status: 'todo', priority: 'low', description: '' });
    store.updateTaskStatus('1', 'in-progress');

    const task = useTaskStore.getState().tasks[0];
    expect(task.status).toBe('in-progress');
  });
});

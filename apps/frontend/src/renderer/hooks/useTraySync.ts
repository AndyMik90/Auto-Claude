/**
 * Hook to sync task store state with the system tray
 *
 * This hook subscribes to the task store and updates the system tray
 * with current task counts whenever tasks change.
 */

import { useEffect } from 'react';
import { useTaskStore } from '../stores/task-store';

/**
 * Count tasks by status for tray display
 */
function getTaskCounts(tasks: { status: string }[]) {
  let running = 0;
  let review = 0;
  let pending = 0;
  let completed = 0;

  for (const task of tasks) {
    switch (task.status) {
      case 'running':
      case 'spec_running':
        running++;
        break;
      case 'review':
        review++;
        break;
      case 'pending':
      case 'queued':
        pending++;
        break;
      case 'done':
      case 'merged':
      case 'archived':
        completed++;
        break;
    }
  }

  return { running, review, pending, completed };
}

/**
 * Hook that syncs task state to system tray
 * Should be called once in the root App component
 */
export function useTraySync(): void {
  const tasks = useTaskStore((state) => state.tasks);

  useEffect(() => {
    // Guard: Only run if electronAPI is available
    if (!window.electronAPI?.updateStatus) {
      return;
    }

    // Calculate task counts
    const counts = getTaskCounts(tasks);

    // Update tray via IPC
    window.electronAPI.updateStatus(counts).catch((error) => {
      // Silently ignore errors - tray might not be available
      console.debug('[useTraySync] Failed to update tray:', error);
    });
  }, [tasks]);
}

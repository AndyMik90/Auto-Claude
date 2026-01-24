import { useState, useEffect } from 'react';
import { ConnectionStatus } from './components/ConnectionStatus';
import { KanbanBoard } from './components/KanbanBoard';
import { TaskEditDialog } from './components/TaskEditDialog';
import { TaskCreateDialog } from './components/TaskList';
import { useTaskStore } from './stores/task-store';
import { ipc } from './lib/ipc-abstraction';
import type { Task } from './types';

export function App() {
  const { tasks, setTasks, updateTaskStatus } = useTaskStore();
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);

  // Load tasks on mount
  useEffect(() => {
    // Request tasks from backend
    ipc.send('task:list', { projectId: 'default' });

    // Listen for task list response
    const handleTaskList = (response: any) => {
      if (response.tasks) {
        setTasks(response.tasks);
      }
    };

    ipc.on('task:list:response', handleTaskList);

    return () => {
      ipc.off('task:list:response', handleTaskList);
    };
  }, [setTasks]);

  // Handle task click to open edit dialog
  const handleTaskClick = (task: Task) => {
    setSelectedTask(task);
    setIsEditDialogOpen(true);
  };

  // Handle task status change from drag & drop
  const handleStatusChange = async (taskId: string, newStatus: any) => {
    await updateTaskStatus(taskId, newStatus);
  };

  // Reload tasks after create/edit
  const handleTaskChanged = () => {
    ipc.send('task:list', { projectId: 'default' });
  };

  return (
    <div className="flex h-screen flex-col bg-background">
      {/* Header */}
      <header className="flex items-center justify-between border-b px-4 py-3 bg-card">
        <div className="flex items-center gap-4">
          <h1 className="text-lg font-semibold text-foreground">
            Auto-Claude Web UI
          </h1>
          <TaskCreateDialog projectId="default" onCreated={handleTaskChanged} />
        </div>
        <ConnectionStatus />
      </header>

      {/* Main content - Kanban board */}
      <main className="flex flex-1 overflow-hidden">
        <div className="flex-1 overflow-auto p-4">
          <KanbanBoard
            tasks={tasks}
            onTaskClick={handleTaskClick}
            onStatusChange={handleStatusChange}
          />
        </div>
      </main>

      {/* Task edit dialog */}
      {selectedTask && (
        <TaskEditDialog
          task={selectedTask}
          open={isEditDialogOpen}
          onOpenChange={setIsEditDialogOpen}
          onSaved={handleTaskChanged}
        />
      )}
    </div>
  );
}

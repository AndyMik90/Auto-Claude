import { useState, useEffect } from 'react';
import { Settings, Plus, RefreshCw } from 'lucide-react';
import { ConnectionStatus } from './components/ConnectionStatus';
import { KanbanBoard } from './components/KanbanBoard';
import { TaskEditDialog } from './components/TaskEditDialog';
import { TaskCreateDialog } from './components/TaskList';
import { TooltipProvider } from './components/ui/tooltip';
import { Button } from './components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from './components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from './components/ui/dropdown-menu';
import { useTaskStore } from './stores/task-store';
import { useSettingsStore } from './stores/settings-store';
import { ipc } from './lib/ipc-abstraction';
import type { Task } from './types';

type AppView = 'kanban' | 'settings';

export function App() {
  // Stores
  const { tasks, setTasks, updateTaskStatus, loadTaskOrder } = useTaskStore();
  const { settings, setSettings, profiles, setProfiles } = useSettingsStore();

  // UI State
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [activeView, setActiveView] = useState<AppView>('kanban');
  const [currentProjectId] = useState('default'); // Web version uses single project for now
  const [isRefreshingTasks, setIsRefreshingTasks] = useState(false);

  // Initial load - Load settings and tasks
  useEffect(() => {
    // Request settings from backend
    ipc.send('get-settings');
    ipc.send('get-api-profiles');

    // Request tasks from backend
    loadTasks();

    // Load task order from localStorage
    loadTaskOrder(currentProjectId);

    // Set up IPC listeners for settings
    const handleSettingsLoaded = (data: any) => {
      if (data) {
        setSettings(data);
      }
    };

    const handleProfilesLoaded = (data: any) => {
      if (data?.profiles && data?.activeProfileId !== undefined) {
        setProfiles(data.profiles, data.activeProfileId);
      }
    };

    ipc.on('settings-loaded', handleSettingsLoaded);
    ipc.on('api-profiles-loaded', handleProfilesLoaded);

    return () => {
      ipc.off('settings-loaded', handleSettingsLoaded);
      ipc.off('api-profiles-loaded', handleProfilesLoaded);
    };
  }, [setSettings, setProfiles, loadTaskOrder, currentProjectId]);

  // Load tasks from backend
  const loadTasks = () => {
    ipc.send('task:list', { projectId: currentProjectId });

    const handleTaskList = (response: any) => {
      if (response.tasks) {
        setTasks(response.tasks);
      }
    };

    ipc.on('task:list:response', handleTaskList);

    // Cleanup listener after receiving response
    setTimeout(() => {
      ipc.off('task:list:response', handleTaskList);
    }, 5000);
  };

  // Handle task click to open edit dialog
  const handleTaskClick = (task: Task) => {
    setSelectedTask(task);
    setIsEditDialogOpen(true);
  };

  // Handle task status change from drag & drop
  const handleStatusChange = async (taskId: string, newStatus: any) => {
    await updateTaskStatus(taskId, newStatus);

    // Persist task order to backend
    ipc.send('task:save-order', {
      projectId: currentProjectId,
      order: useTaskStore.getState().taskOrder
    });
  };

  // Reload tasks after create/edit
  const handleTaskChanged = () => {
    loadTasks();
  };

  // Handle refresh tasks
  const handleRefreshTasks = async () => {
    setIsRefreshingTasks(true);
    loadTasks();

    // Reset loading state after a delay
    setTimeout(() => {
      setIsRefreshingTasks(false);
    }, 1000);
  };

  // Render main content based on active view
  const renderMainContent = () => {
    switch (activeView) {
      case 'kanban':
        return (
          <div className="flex-1 overflow-auto p-4">
            <KanbanBoard
              tasks={tasks}
              onTaskClick={handleTaskClick}
              onStatusChange={handleStatusChange}
            />
          </div>
        );
      case 'settings':
        return (
          <div className="flex-1 overflow-auto p-8">
            <div className="max-w-4xl mx-auto">
              <h1 className="text-2xl font-bold mb-6">Settings</h1>
              <div className="space-y-6">
                <div className="rounded-lg border p-6">
                  <h2 className="text-lg font-semibold mb-4">Application Settings</h2>
                  <div className="space-y-4">
                    <div>
                      <label className="text-sm font-medium">Theme</label>
                      <p className="text-sm text-muted-foreground mt-1">
                        Current: {settings.theme || 'system'}
                      </p>
                    </div>
                    <div>
                      <label className="text-sm font-medium">API Profiles</label>
                      <p className="text-sm text-muted-foreground mt-1">
                        {profiles.length} profile(s) configured
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <TooltipProvider>
      <div className="flex h-screen flex-col bg-background">
        {/* Header */}
        <header className="flex items-center justify-between border-b px-4 py-3 bg-card">
          <div className="flex items-center gap-4">
            <h1 className="text-lg font-semibold text-foreground">
              Auto-Claude Web
            </h1>

            {/* Navigation */}
            <div className="flex items-center gap-2">
              <Button
                variant={activeView === 'kanban' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setActiveView('kanban')}
              >
                Tasks
              </Button>
            </div>

            {/* Action buttons */}
            {activeView === 'kanban' && (
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsCreateDialogOpen(true)}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  New Task
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleRefreshTasks}
                  disabled={isRefreshingTasks}
                >
                  <RefreshCw className={`h-4 w-4 ${isRefreshingTasks ? 'animate-spin' : ''}`} />
                </Button>
              </div>
            )}
          </div>

          <div className="flex items-center gap-4">
            <ConnectionStatus />

            {/* Settings menu */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm">
                  <Settings className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => setActiveView('settings')}>
                  Settings
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleRefreshTasks}>
                  Refresh Tasks
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        {/* Main content */}
        <main className="flex flex-1 overflow-hidden">
          {renderMainContent()}
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

        {/* Task creation dialog */}
        <TaskCreateDialog
          projectId={currentProjectId}
          open={isCreateDialogOpen}
          onOpenChange={setIsCreateDialogOpen}
          onCreated={handleTaskChanged}
        />
      </div>
    </TooltipProvider>
  );
}

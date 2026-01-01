import { ViewStateProvider } from '@/contexts/ViewStateContext';
import { TooltipProvider } from '@/components/ui/tooltip';
import { ZenMode } from '@/components/ZenMode';
import type { AppLayoutProps } from './types';
import { AppMainContent } from './AppMainContent';

interface AppLayoutExtendedProps extends AppLayoutProps {
  activeView: import('@/components/Sidebar').SidebarView;
  setActiveView: (view: import('@/components/Sidebar').SidebarView) => void;
  setIsNewTaskDialogOpen: (open: boolean) => void;
  setIsSettingsDialogOpen: (open: boolean) => void;
  setSettingsInitialProjectSection: (section?: string) => void;
  setSelectedTask: (task: any) => void;
  sensors: any;
  settingsInitialProjectSection?: string;
  selectedTask: any;
  handleOpenInbuiltTerminal: (task: any) => Promise<void>;
  handleCloseTaskDetail: () => void;
}

/**
 * Main layout wrapper component
 * Provides context providers and handles Zen Mode vs normal mode
 */
export function AppLayout({
  projects,
  projectTabs,
  activeProjectId,
  selectedProjectId,
  selectedProject,
  tasks,
  activeView,
  activeDragProject,
  onTaskClick,
  onNewTaskClick,
  onSettingsClick,
  onAddProject,
  onProjectSelect,
  onProjectClose,
  onDragStart,
  onDragEnd,
  onGoToTask,
  activeView: viewProp,
  setActiveView,
  setIsNewTaskDialogOpen,
  setIsSettingsDialogOpen,
  setSettingsInitialProjectSection,
  setSelectedTask,
  sensors,
  settingsInitialProjectSection,
  selectedTask,
  handleOpenInbuiltTerminal,
  handleCloseTaskDetail,
}: AppLayoutExtendedProps) {
  return (
    <ViewStateProvider>
      <TooltipProvider>
        {/* Zen Mode - fullscreen overlay when active */}
        {activeView === 'zen' ? (
          <ZenMode
            onExit={() => setActiveView('kanban')}
            onTaskCreated={(taskId) => {
              // Load tasks and switch to kanban view
              const currentProjectId = activeProjectId || selectedProjectId;
              if (currentProjectId) {
                import('../../stores/project-store').then(({ loadTasks }) => {
                  loadTasks(currentProjectId);
                });
              }
              // Find the created task and select it
              const createdTask = tasks.find(t => t.id === taskId);
              if (createdTask) {
                setSelectedTask(createdTask);
              }
              // Switch to kanban view to see the task
              setActiveView('kanban');
            }}
          />
        ) : (
          <AppMainContent
            projects={projects}
            projectTabs={projectTabs}
            activeProjectId={activeProjectId}
            selectedProjectId={selectedProjectId}
            selectedProject={selectedProject}
            tasks={tasks}
            activeView={activeView}
            activeDragProject={activeDragProject}
            sensors={sensors}
            settingsInitialProjectSection={settingsInitialProjectSection}
            setIsSettingsDialogOpen={setIsSettingsDialogOpen}
            setSettingsInitialProjectSection={setSettingsInitialProjectSection}
            setIsNewTaskDialogOpen={setIsNewTaskDialogOpen}
            setSelectedTask={setSelectedTask}
            setActiveView={setActiveView}
            onTaskClick={onTaskClick}
            onNewTaskClick={onNewTaskClick}
            onSettingsClick={onSettingsClick}
            onAddProject={onAddProject}
            onProjectSelect={onProjectSelect}
            onProjectClose={onProjectClose}
            onDragStart={onDragStart}
            onDragEnd={onDragEnd}
            onGoToTask={onGoToTask}
            handleOpenInbuiltTerminal={handleOpenInbuiltTerminal}
            handleCloseTaskDetail={handleCloseTaskDetail}
            selectedTask={selectedTask}
          />
        )}
      </TooltipProvider>
    </ViewStateProvider>
  );
}

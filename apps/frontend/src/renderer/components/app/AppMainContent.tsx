import { DndContext, closestCenter, DragOverlay, SensorsArgument, DragEndEvent } from '@dnd-kit/core';
import { SortableContext, horizontalListSortingStrategy } from '@dnd-kit/sortable';
import type { Project, Task } from '@shared/types';
import type { SidebarView } from '@/components/Sidebar';
import { Sidebar } from '@/components/Sidebar';
import { KanbanBoard } from '@/components/KanbanBoard';
import { TerminalGrid } from '@/components/TerminalGrid';
import { Roadmap } from '@/components/Roadmap';
import { Context } from '@/components/Context';
import { Ideation } from '@/components/Ideation';
import { Insights } from '@/components/Insights';
import { GitHubIssues } from '@/components/GitHubIssues';
import { GitLabIssues } from '@/components/GitLabIssues';
import { GitHubPRs } from '@/components/github-prs';
import { GitLabMergeRequests } from '@/components/gitlab-merge-requests';
import { Changelog } from '@/components/Changelog';
import { Worktrees } from '@/components/Worktrees';
import { AgentTools } from '@/components/AgentTools';
import { WelcomeScreen } from '@/components/WelcomeScreen';
import { ProjectTabBar } from '@/components/ProjectTabBar';
import { TaskDetailModal } from '@/components/task-detail/TaskDetailModal';
import { useViewState } from '@/contexts/ViewStateContext';

interface AppMainContentProps {
  projects: Project[];
  projectTabs: Project[];
  activeProjectId: string | null;
  selectedProjectId: string | null;
  selectedProject: Project | null;
  tasks: Task[];
  activeView: SidebarView;
  activeDragProject: Project | null;
  sensors: SensorsArgument;
  settingsInitialProjectSection?: string;
  setIsSettingsDialogOpen: (open: boolean) => void;
  setSettingsInitialProjectSection: (section?: string) => void;
  setIsNewTaskDialogOpen: (open: boolean) => void;
  setSelectedTask: (task: Task | null) => void;
  setActiveView: (view: SidebarView) => void;
  onTaskClick: (task: Task) => void;
  onNewTaskClick: () => void;
  onSettingsClick: () => void;
  onAddProject: () => void;
  onProjectSelect: (projectId: string) => void;
  onProjectClose: (projectId: string) => void;
  onDragStart: (event: DragEndEvent) => void;
  onDragEnd: (event: DragEndEvent) => void;
  onGoToTask: (taskId: string) => void;
  handleOpenInbuiltTerminal: (task: Task) => Promise<void>;
  handleCloseTaskDetail: () => void;
  selectedTask: Task | null;
}

/**
 * Main content area renderer
 * Handles the sidebar, project tabs, and view switching
 */
export function AppMainContent({
  projects,
  projectTabs,
  activeProjectId,
  selectedProjectId,
  selectedProject,
  tasks,
  activeView,
  activeDragProject,
  sensors,
  settingsInitialProjectSection,
  setIsSettingsDialogOpen,
  setSettingsInitialProjectSection,
  setIsNewTaskDialogOpen,
  setSelectedTask,
  setActiveView,
  onTaskClick,
  onNewTaskClick,
  onSettingsClick,
  onAddProject,
  onProjectSelect,
  onProjectClose,
  onDragStart,
  onDragEnd,
  onGoToTask,
  handleOpenInbuiltTerminal,
  handleCloseTaskDetail,
  selectedTask,
}: AppMainContentProps) {
  const currentProjectId = activeProjectId || selectedProjectId;
  const { showArchived, toggleShowArchived } = useViewState();
  const archivedCount = tasks.filter(t => t.metadata?.archivedAt).length;

  // Wrapper component for ProjectTabBar with ViewStateContext
  function ProjectTabBarWithContext({
    projects,
    activeProjectId,
    onProjectSelect,
    onProjectClose,
    onAddProject,
    onSettingsClick,
  }: {
    projects: Project[];
    activeProjectId: string | null;
    onProjectSelect: (projectId: string) => void;
    onProjectClose: (projectId: string) => void;
    onAddProject: () => void;
    onSettingsClick: () => void;
  }) {
    return (
      <ProjectTabBar
        projects={projects}
        activeProjectId={activeProjectId}
        onProjectSelect={onProjectSelect}
        onProjectClose={onProjectClose}
        onAddProject={onAddProject}
        onSettingsClick={onSettingsClick}
        showArchived={showArchived}
        archivedCount={archivedCount}
        onToggleArchived={toggleShowArchived}
      />
    );
  }

  return (
    <div className="flex h-screen bg-background">
      {/* Sidebar */}
      <Sidebar
        onSettingsClick={onSettingsClick}
        onNewTaskClick={onNewTaskClick}
        activeView={activeView}
        onViewChange={setActiveView}
      />

      {/* Main content */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Project Tabs */}
        {projectTabs.length > 0 && (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragStart={onDragStart}
            onDragEnd={onDragEnd}
          >
            <SortableContext items={projectTabs.map(p => p.id)} strategy={horizontalListSortingStrategy}>
              <ProjectTabBarWithContext
                projects={projectTabs}
                activeProjectId={activeProjectId}
                onProjectSelect={onProjectSelect}
                onProjectClose={onProjectClose}
                onAddProject={onAddProject}
                onSettingsClick={() => setIsSettingsDialogOpen(true)}
              />
            </SortableContext>

            {/* Drag overlay - shows what's being dragged */}
            <DragOverlay>
              {activeDragProject && (
                <div className="flex items-center gap-2 bg-card border border-border rounded-md px-4 py-2.5 shadow-lg max-w-[200px]">
                  <div className="w-1 h-4 bg-muted-foreground rounded-full" />
                  <span className="truncate font-medium text-sm">
                    {activeDragProject.name}
                  </span>
                </div>
              )}
            </DragOverlay>
          </DndContext>
        )}

        {/* Main content area */}
        <main className="flex-1 overflow-hidden">
          {selectedProject ? (
            <>
              {activeView === 'kanban' && (
                <KanbanBoard
                  tasks={tasks}
                  onTaskClick={onTaskClick}
                  onNewTaskClick={onNewTaskClick}
                />
              )}
              {/* TerminalGrid is always mounted but hidden when not active to preserve terminal state */}
              <div className={activeView === 'terminals' ? 'h-full' : 'hidden'}>
                <TerminalGrid
                  projectPath={selectedProject?.path}
                  onNewTaskClick={onNewTaskClick}
                  isActive={activeView === 'terminals'}
                />
              </div>
              {activeView === 'roadmap' && currentProjectId && (
                <Roadmap projectId={currentProjectId} onGoToTask={onGoToTask} />
              )}
              {activeView === 'context' && currentProjectId && (
                <Context projectId={currentProjectId} />
              )}
              {activeView === 'ideation' && currentProjectId && (
                <Ideation projectId={currentProjectId} onGoToTask={onGoToTask} />
              )}
              {activeView === 'insights' && currentProjectId && (
                <Insights projectId={currentProjectId} />
              )}
              {activeView === 'github-issues' && currentProjectId && (
                <GitHubIssues
                  onOpenSettings={() => {
                    setSettingsInitialProjectSection('github');
                    setIsSettingsDialogOpen(true);
                  }}
                  onNavigateToTask={onGoToTask}
                />
              )}
              {activeView === 'gitlab-issues' && currentProjectId && (
                <GitLabIssues
                  onOpenSettings={() => {
                    setSettingsInitialProjectSection('gitlab');
                    setIsSettingsDialogOpen(true);
                  }}
                  onNavigateToTask={onGoToTask}
                />
              )}
              {activeView === 'github-prs' && currentProjectId && (
                <GitHubPRs
                  onOpenSettings={() => {
                    setSettingsInitialProjectSection('github');
                    setIsSettingsDialogOpen(true);
                  }}
                />
              )}
              {activeView === 'gitlab-merge-requests' && currentProjectId && (
                <GitLabMergeRequests
                  projectId={currentProjectId}
                  onOpenSettings={() => {
                    setSettingsInitialProjectSection('gitlab');
                    setIsSettingsDialogOpen(true);
                  }}
                />
              )}
              {activeView === 'changelog' && currentProjectId && (
                <Changelog />
              )}
              {activeView === 'worktrees' && currentProjectId && (
                <Worktrees projectId={currentProjectId} />
              )}
              {activeView === 'agent-tools' && <AgentTools />}
            </>
          ) : (
            <WelcomeScreen
              projects={projects}
              onNewProject={onAddProject}
              onOpenProject={onAddProject}
              onSelectProject={onProjectSelect}
            />
          )}
        </main>
      </div>

      {/* Task detail modal */}
      <TaskDetailModal
        open={!!selectedTask}
        task={selectedTask}
        onOpenChange={(open) => !open && handleCloseTaskDetail()}
        onSwitchToTerminals={() => setActiveView('terminals')}
        onOpenInbuiltTerminal={handleOpenInbuiltTerminal}
      />
    </div>
  );
}

import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  DndContext,
  DragOverlay,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent
} from '@dnd-kit/core';
import {
  SortableContext,
  horizontalListSortingStrategy
} from '@dnd-kit/sortable';
import { Sidebar, type SidebarView } from './components/Sidebar';
import { TaskDetailModal } from './components/task-detail/TaskDetailModal';
import { AddProjectModal } from './components/AddProjectModal';
import { useProjectStore, loadProjects, addProject } from './stores/project-store';
import { useTaskStore, loadTasks } from './stores/task-store';
import { useSettingsStore, loadSettings } from './stores/settings-store';
import { useTerminalStore, restoreTerminalSessions } from './stores/terminal-store';
import { initializeGitHubListeners } from './stores/github';
import { initDownloadProgressListener } from './stores/download-store';
import { useIpcListeners } from './hooks/useIpc';
import { COLOR_THEMES, UI_SCALE_MIN, UI_SCALE_MAX, UI_SCALE_DEFAULT } from '../shared/constants';
import type { Task, Project } from '../shared/types';
import type { AppSection } from './components/settings/AppSettings';
import type { ProjectSettingsSection } from './components/settings/ProjectSettingsContent';

// New hooks and components from app refactoring
import {
  useAppInitialization,
  useAppTheme,
  useAppEffects,
  useProjectTabEffects,
  useAppUpdateListener,
  useAppSettingsListener,
  useTaskUpdateEffect,
  useTerminalRestoreEffect,
  useTaskLoadEffect,
  AppLayout,
} from './components/app';
import { AppDialogs } from './components/app/dialogs/AppDialogs';
import { ProactiveSwapListener } from './components/ProactiveSwapListener';

export function App() {
  // Load IPC listeners for real-time updates
  useIpcListeners();

  // Stores
  const projects = useProjectStore((state) => state.projects);
  const selectedProjectId = useProjectStore((state) => state.selectedProjectId);
  const activeProjectId = useProjectStore((state) => state.activeProjectId);
  const getProjectTabs = useProjectStore((state) => state.getProjectTabs);
  const openProjectIds = useProjectStore((state) => state.openProjectIds);
  const openProjectTab = useProjectStore((state) => state.openProjectTab);
  const closeProjectTab = useProjectStore((state) => state.closeProjectTab);
  const setActiveProject = useProjectStore((state) => state.setActiveProject);
  const reorderTabs = useProjectStore((state) => state.reorderTabs);
  const tasks = useTaskStore((state) => state.tasks);
  const settings = useSettingsStore((state) => state.settings);
  const settingsLoading = useSettingsStore((state) => state.isLoading);

  // UI State
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [isNewTaskDialogOpen, setIsNewTaskDialogOpen] = useState(false);
  const [isSettingsDialogOpen, setIsSettingsDialogOpen] = useState(false);
  const [settingsInitialSection, setSettingsInitialSection] = useState<AppSection | undefined>(undefined);
  const [settingsInitialProjectSection, setSettingsInitialProjectSection] = useState<ProjectSettingsSection | undefined>(undefined);
  const [activeView, setActiveView] = useState<SidebarView>('kanban');
  const [isOnboardingWizardOpen, setIsOnboardingWizardOpen] = useState(false);
  const [showAddProjectModal, setShowAddProjectModal] = useState(false);

  // Initialize dialog state from useAppInitialization hook
  const init = useAppInitialization(selectedProject);
  const {
    pendingProject,
    isInitializing,
    initSuccess,
    initError,
    skippedInitProjectId,
    gitHubSetupProject,
    handleInitialize,
    handleSkipInit,
    handleGitHubSetupComplete: handleGitHubSetupCompleteFromHook,
    handleGitHubSetupSkip,
  } = init;

  // Sync init dialog state with hook's pendingProject
  const [showInitDialog, setShowInitDialog] = useState(false);
  useEffect(() => {
    setShowInitDialog(!!pendingProject);
  }, [pendingProject]);

  // GitHub setup state
  const [showGitHubSetup, setShowGitHubSetup] = useState(false);
  useEffect(() => {
    if (gitHubSetupProject) {
      setShowGitHubSetup(true);
    }
  }, [gitHubSetupProject]);

  // GitHub setup handlers (extend hook handlers with full implementation)
  const handleGitHubSetupComplete = async (settings: {
    githubToken: string;
    githubRepo: string;
    mainBranch: string;
    githubAuthMethod?: 'oauth' | 'pat';
  }) => {
    if (!gitHubSetupProject) return;

    try {
      await window.electronAPI.updateProjectEnv(gitHubSetupProject.id, {
        githubEnabled: true,
        githubToken: settings.githubToken,
        githubRepo: settings.githubRepo,
        githubAuthMethod: settings.githubAuthMethod
      });
      await window.electronAPI.updateProjectSettings(gitHubSetupProject.id, {
        mainBranch: settings.mainBranch
      });
      await loadProjects();
    } catch (error) {
      console.error('Failed to save GitHub settings:', error);
    }

    handleGitHubSetupCompleteFromHook();
  };

  // Setup drag sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // 8px movement required before drag starts
      },
    })
  );

  // Track dragging state for overlay
  const [activeDragProject, setActiveDragProject] = useState<Project | null>(null);

  // Get tabs and selected project
  const projectTabs = getProjectTabs();
  const selectedProject = projects.find((p) => p.id === (activeProjectId || selectedProjectId));

  // Initial load
  useEffect(() => {
    loadProjects();
    loadSettings();
    // Initialize global GitHub listeners (PR reviews, etc.) so they persist across navigation
    initializeGitHubListeners();
    // Initialize global download progress listener for Ollama model downloads
    const cleanupDownloadListener = initDownloadProgressListener();

    return () => {
      cleanupDownloadListener();
    };
  }, []);

  // Restore tab state and open tabs for loaded projects
  useProjectTabEffects(
    projects,
    openProjectIds,
    activeProjectId,
    selectedProjectId
  );

  // Track if settings have been loaded at least once
  const [settingsHaveLoaded, setSettingsHaveLoaded] = useState(false);

  // Mark settings as loaded when loading completes
  useEffect(() => {
    if (!settingsLoading && !settingsHaveLoaded) {
      setSettingsHaveLoaded(true);
    }
  }, [settingsLoading, settingsHaveLoaded]);

  // First-run detection - show onboarding wizard if not completed
  // Only check AFTER settings have been loaded from disk to avoid race condition
  useEffect(() => {
    if (settingsHaveLoaded && settings.onboardingCompleted === false) {
      setIsOnboardingWizardOpen(true);
    }
  }, [settingsHaveLoaded, settings.onboardingCompleted]);

  // Sync i18n language with settings
  const { t, i18n } = useTranslation('dialogs');
  useEffect(() => {
    if (settings.language && settings.language !== i18n.language) {
      i18n.changeLanguage(settings.language);
    }
  }, [settings.language, i18n]);

  // Listen for open-app-settings events (e.g., from project settings)
  useAppSettingsListener((section) => {
    if (section) {
      setSettingsInitialSection(section);
    }
    setIsSettingsDialogOpen(true);
  });

  // Listen for app updates - auto-open settings to 'updates' section when update is ready
  useAppUpdateListener(() => {
    setSettingsInitialSection('updates');
    setIsSettingsDialogOpen(true);
  });

  // Global keyboard shortcut: Cmd/Ctrl+T to add project (when not on terminals view)
  useEffect(() => {
    const handleKeyDown = async (e: KeyboardEvent) => {
      // Skip if in input fields
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        (e.target as HTMLElement)?.isContentEditable
      ) {
        return;
      }

      // Cmd/Ctrl+T: Add new project (only when not on terminals view)
      if ((e.ctrlKey || e.metaKey) && e.key === 't' && activeView !== 'terminals') {
        e.preventDefault();
        try {
          const path = await window.electronAPI.selectDirectory();
          if (path) {
            const project = await addProject(path);
            if (project) {
              openProjectTab(project.id);
              // Make the project active so the init hook can detect it needs initialization
              setActiveProject(project.id);
            }
          }
        } catch (error) {
          console.error('Failed to add project:', error);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeView, openProjectTab, setActiveProject]);

  // Load tasks when project changes
  useTaskLoadEffect(
    activeProjectId,
    selectedProjectId,
    loadTasks,
    () => useTaskStore.getState().clearTasks(),
    () => setSelectedTask(null)
  );

  // Handle terminals on project change
  useTerminalRestoreEffect(selectedProject, restoreTerminalSessions);

  // Apply theme on load
  useAppTheme(settings);

  // Apply UI scale
  useEffect(() => {
    const root = document.documentElement;
    const scale = settings.uiScale ?? UI_SCALE_DEFAULT;
    const clampedScale = Math.max(UI_SCALE_MIN, Math.min(UI_SCALE_MAX, scale));
    root.setAttribute('data-ui-scale', clampedScale.toString());
  }, [settings.uiScale]);

  // Update selected task when tasks change (for real-time updates)
  useTaskUpdateEffect(tasks, selectedTask, setSelectedTask);

  const handleTaskClick = (task: Task) => {
    setSelectedTask(task);
  };

  const handleCloseTaskDetail = () => {
    setSelectedTask(null);
  };

  const handleOpenInbuiltTerminal = (_id: string, cwd: string) => {
    // Note: _id parameter is intentionally unused - terminal ID is auto-generated by addTerminal()
    // Parameter kept for callback signature consistency with callers
    console.log('[App] Opening inbuilt terminal:', { cwd });

    // Switch to terminals view
    setActiveView('terminals');

    // Close modal
    setSelectedTask(null);

    // Add terminal to store - this will trigger Terminal component to mount
    // which will then create the backend PTY via usePtyProcess
    // Note: TerminalGrid is always mounted (just hidden), so no need to wait
    const terminal = useTerminalStore.getState().addTerminal(cwd, selectedProject?.path);

    if (!terminal) {
      console.error('[App] Failed to add terminal to store (max terminals reached?)');
    } else {
      console.log('[App] Terminal added to store:', terminal.id);
    }
  };

  const handleAddProject = () => {
    setShowAddProjectModal(true);
  };

  const handleProjectAdded = (project: Project, _needsInit?: boolean) => {
    openProjectTab(project.id);
    // Make the project active so the init hook can detect if it needs initialization
    setActiveProject(project.id);
  };

  const handleProjectTabSelect = (projectId: string) => {
    setActiveProject(projectId);
  };

  const handleProjectTabClose = (projectId: string) => {
    closeProjectTab(projectId);
  };

  // Handle drag start - set the active dragged project
  const handleDragStart = (event: any) => {
    const { active } = event;
    const draggedProject = projectTabs.find(p => p.id === active.id);
    if (draggedProject) {
      setActiveDragProject(draggedProject);
    }
  };

  // Handle drag end - reorder tabs if dropped over another tab
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveDragProject(null);

    if (!over) return;

    const oldIndex = projectTabs.findIndex(p => p.id === active.id);
    const newIndex = projectTabs.findIndex(p => p.id === over.id);

    if (oldIndex !== newIndex && oldIndex !== -1 && newIndex !== -1) {
      reorderTabs(oldIndex, newIndex);
    }
  };

  const handleGoToTask = (taskId: string) => {
    // Switch to kanban view
    setActiveView('kanban');
    // Find and select the task (match by id or specId)
    const task = tasks.find((t) => t.id === taskId || t.specId === taskId);
    if (task) {
      setSelectedTask(task);
    }
  };

  return (
    <>
      <ProactiveSwapListener />
      <AppLayout
        projects={projects}
        projectTabs={projectTabs}
        activeProjectId={activeProjectId}
        selectedProjectId={selectedProjectId}
        selectedProject={selectedProject}
        tasks={tasks}
        activeView={activeView}
        activeDragProject={activeDragProject}
        onTaskClick={handleTaskClick}
        onNewTaskClick={() => setIsNewTaskDialogOpen(true)}
        onSettingsClick={() => setIsSettingsDialogOpen(true)}
        onAddProject={handleAddProject}
        onProjectSelect={handleProjectTabSelect}
        onProjectClose={handleProjectTabClose}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onGoToTask={handleGoToTask}
        sensors={sensors}
        settingsInitialProjectSection={settingsInitialProjectSection}
        selectedTask={selectedTask}
        handleOpenInbuiltTerminal={handleOpenInbuiltTerminal}
        handleCloseTaskDetail={handleCloseTaskDetail}
        setActiveView={setActiveView}
        setIsNewTaskDialogOpen={setIsNewTaskDialogOpen}
        setIsSettingsDialogOpen={setIsSettingsDialogOpen}
        setSettingsInitialProjectSection={setSettingsInitialProjectSection}
        setSelectedTask={setSelectedTask}
      />

      {/* Task detail modal */}
      <TaskDetailModal
        open={!!selectedTask}
        task={selectedTask}
        onOpenChange={(open) => !open && handleCloseTaskDetail()}
        onSwitchToTerminals={() => setActiveView('terminals')}
        onOpenInbuiltTerminal={handleOpenInbuiltTerminal}
      />

      {/* App Dialogs */}
      <AppDialogs
        isNewTaskDialogOpen={isNewTaskDialogOpen}
        setIsNewTaskDialogOpen={setIsNewTaskDialogOpen}
        isSettingsDialogOpen={isSettingsDialogOpen}
        setIsSettingsDialogOpen={setIsSettingsDialogOpen}
        showAddProjectModal={showAddProjectModal}
        setShowAddProjectModal={setShowAddProjectModal}
        isOnboardingWizardOpen={isOnboardingWizardOpen}
        setIsOnboardingWizardOpen={setIsOnboardingWizardOpen}
        settingsInitialSection={settingsInitialSection}
        settingsInitialProjectSection={settingsInitialProjectSection}
        setSettingsInitialSection={setSettingsInitialSection}
        setSettingsInitialProjectSection={setSettingsInitialProjectSection}

        // Init dialog props
        showInitDialog={showInitDialog}
        setShowInitDialog={setShowInitDialog}
        settings={settings}
        isInitializing={isInitializing}
        initError={initError}
        pendingProject={pendingProject}
        initSuccess={initSuccess}
        onInitialize={handleInitialize}
        onSkipInit={handleSkipInit}

        // GitHub setup props
        showGitHubSetup={showGitHubSetup}
        setShowGitHubSetup={setShowGitHubSetup}
        gitHubSetupProject={gitHubSetupProject}
        onGitHubSetupComplete={handleGitHubSetupComplete}
        onGitHubSetupSkip={handleGitHubSetupSkip}

        // Project/task props
        activeProjectId={activeProjectId || selectedProjectId}
        selectedProjectId={selectedProjectId}
        onProjectAdded={handleProjectAdded}
      />
    </>
  );
}

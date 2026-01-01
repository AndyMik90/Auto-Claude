import type { Project, Task } from '@shared/types';
import type { AppSection } from '@/components/settings/AppSettings';
import type { ProjectSettingsSection } from '@/components/settings/ProjectSettingsContent';
import type { SidebarView } from '@/components/Sidebar';

export interface AppDialogState {
  showInitDialog: boolean;
  showGitHubSetup: boolean;
  showAddProjectModal: boolean;
  isNewTaskDialogOpen: boolean;
  isSettingsDialogOpen: boolean;
  isOnboardingWizardOpen: boolean;
}

export interface AppInitializationState {
  pendingProject: Project | null;
  isInitializing: boolean;
  initSuccess: boolean;
  initError: string | null;
  skippedInitProjectId: string | null;
  gitHubSetupProject: Project | null;
}

export interface AppStateCallbacks {
  setShowInitDialog: (show: boolean) => void;
  setShowGitHubSetup: (show: boolean) => void;
  setShowAddProjectModal: (show: boolean) => void;
  setIsNewTaskDialogOpen: (show: boolean) => void;
  setIsSettingsDialogOpen: (show: boolean) => void;
  setIsOnboardingWizardOpen: (show: boolean) => void;
}

export interface AppLayoutProps {
  projects: Project[];
  projectTabs: Project[];
  activeProjectId: string | null;
  selectedProjectId: string | null;
  selectedProject: Project | null;
  tasks: Task[];
  activeView: SidebarView;
  activeDragProject: Project | null;
  onTaskClick: (task: Task) => void;
  onNewTaskClick: () => void;
  onSettingsClick: () => void;
  onAddProject: () => void;
  onProjectSelect: (projectId: string) => void;
  onProjectClose: (projectId: string) => void;
  onDragStart: (event: any) => void;
  onDragEnd: (event: any) => void;
  onGoToTask: (taskId: string) => void;
}

export type { AppSection, ProjectSettingsSection, SidebarView };

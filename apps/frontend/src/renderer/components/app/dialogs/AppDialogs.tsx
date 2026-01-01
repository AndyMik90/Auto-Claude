import { TaskCreationWizard } from '@/components/./TaskCreationWizard';
import { AppSettingsDialog, type AppSection } from '@/components/./settings/AppSettings';
import { AddProjectModal } from '@/components/./AddProjectModal';
import { GitHubSetupModal } from '@/components/./GitHubSetupModal';
import { RateLimitModal } from '@/components/./RateLimitModal';
import { SDKRateLimitModal } from '@/components/./SDKRateLimitModal';
import { OnboardingWizard } from '@/components/./onboarding/OnboardingWizard';
import { AppUpdateNotification } from '@/components/./AppUpdateNotification';
import { GlobalDownloadIndicator } from '@/components/./GlobalDownloadIndicator';
import { InitDialog } from './InitDialog';
import type { Project, AppSettings } from '@/components/./../shared/types';

interface AppDialogsProps {
  // Dialog state
  isNewTaskDialogOpen: boolean;
  setIsNewTaskDialogOpen: (open: boolean) => void;
  isSettingsDialogOpen: boolean;
  setIsSettingsDialogOpen: (open: boolean) => void;
  showAddProjectModal: boolean;
  setShowAddProjectModal: (open: boolean) => void;
  isOnboardingWizardOpen: boolean;
  setIsOnboardingWizardOpen: (open: boolean) => void;
  settingsInitialSection?: AppSection;
  settingsInitialProjectSection?: string;
  setSettingsInitialSection: (section?: AppSection) => void;
  setSettingsInitialProjectSection: (section?: string) => void;

  // Init dialog props
  showInitDialog: boolean;
  setShowInitDialog: (open: boolean) => void;
  settings: AppSettings;
  isInitializing: boolean;
  initError: string | null;
  pendingProject: Project | null;
  initSuccess: boolean;
  onInitialize: () => void;
  onSkipInit: () => void;

  // GitHub setup props
  showGitHubSetup: boolean;
  setShowGitHubSetup: (open: boolean) => void;
  gitHubSetupProject: Project | null;
  onGitHubSetupComplete: () => void;
  onGitHubSetupSkip: () => void;

  // Project/task props
  activeProjectId: string | null;
  selectedProjectId: string | null;
  onProjectAdded: (project: Project) => void;
}

/**
 * Orchestrator component for all app-level dialogs
 * Centralizes dialog state and rendering
 */
export function AppDialogs({
  isNewTaskDialogOpen,
  setIsNewTaskDialogOpen,
  isSettingsDialogOpen,
  setIsSettingsDialogOpen,
  showAddProjectModal,
  setShowAddProjectModal,
  isOnboardingWizardOpen,
  setIsOnboardingWizardOpen,
  settingsInitialSection,
  settingsInitialProjectSection,
  setSettingsInitialSection,
  setSettingsInitialProjectSection,

  showInitDialog,
  setShowInitDialog,
  settings,
  isInitializing,
  initError,
  pendingProject,
  initSuccess,
  onInitialize,
  onSkipInit,

  showGitHubSetup,
  setShowGitHubSetup,
  gitHubSetupProject,
  onGitHubSetupComplete,
  onGitHubSetupSkip,

  activeProjectId,
  selectedProjectId,
  onProjectAdded,
}: AppDialogsProps) {
  return (
    <>
      {/* Task Creation Wizard */}
      {(activeProjectId || selectedProjectId) && (
        <TaskCreationWizard
          projectId={activeProjectId || selectedProjectId!}
          open={isNewTaskDialogOpen}
          onOpenChange={setIsNewTaskDialogOpen}
        />
      )}

      {/* App Settings Dialog */}
      <AppSettingsDialog
        open={isSettingsDialogOpen}
        onOpenChange={(open) => {
          setIsSettingsDialogOpen(open);
          if (!open) {
            // Reset initial sections when dialog closes
            setSettingsInitialSection(undefined);
            setSettingsInitialProjectSection(undefined);
          }
        }}
        initialSection={settingsInitialSection}
        initialProjectSection={settingsInitialProjectSection}
        onRerunWizard={() => {
          // Reset onboarding state to trigger wizard
          import('@/stores/settings-store').then(({ useSettingsStore }) => {
            useSettingsStore.getState().updateSettings({ onboardingCompleted: false });
          });
          // Close settings dialog
          setIsSettingsDialogOpen(false);
          // Open onboarding wizard
          setIsOnboardingWizardOpen(true);
        }}
      />

      {/* Add Project Modal */}
      <AddProjectModal
        open={showAddProjectModal}
        onOpenChange={setShowAddProjectModal}
        onProjectAdded={onProjectAdded}
      />

      {/* Initialize Auto Claude Dialog */}
      <InitDialog
        open={showInitDialog}
        onOpenChange={(open) => {
          if (!open && pendingProject && !isInitializing && !initSuccess) {
            onSkipInit();
          } else {
            setShowInitDialog(open);
          }
        }}
        settings={settings}
        isInitializing={isInitializing}
        initError={initError}
        onInitialize={onInitialize}
        onSkip={onSkipInit}
      />

      {/* GitHub Setup Modal */}
      {gitHubSetupProject && (
        <GitHubSetupModal
          open={showGitHubSetup}
          onOpenChange={setShowGitHubSetup}
          project={gitHubSetupProject}
          onComplete={onGitHubSetupComplete}
          onSkip={onGitHubSetupSkip}
        />
      )}

      {/* Rate Limit Modals */}
      <RateLimitModal />
      <SDKRateLimitModal />

      {/* Onboarding Wizard */}
      <OnboardingWizard
        open={isOnboardingWizardOpen}
        onOpenChange={setIsOnboardingWizardOpen}
        onOpenTaskCreator={() => {
          setIsOnboardingWizardOpen(false);
          setIsNewTaskDialogOpen(true);
        }}
        onOpenSettings={() => {
          setIsOnboardingWizardOpen(false);
          setIsSettingsDialogOpen(true);
        }}
      />

      {/* App Update Notification */}
      <AppUpdateNotification />

      {/* Global Download Indicator */}
      <GlobalDownloadIndicator />
    </>
  );
}

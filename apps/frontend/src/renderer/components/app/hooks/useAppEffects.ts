import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { loadProjects } from '@/stores/project-store';
import { loadSettings } from '@/stores/settings-store';
import { initializeGitHubListeners } from '@/stores/github';
import { initDownloadProgressListener } from '@/stores/download-store';
import type { Project } from '@shared/types';

/**
 * Hook to handle core app effects
 * Handles initial load, settings tracking, onboarding, and various app-level listeners
 */
export function useAppEffects() {
  const [settingsHaveLoaded, setSettingsHaveLoaded] = useState(false);
  const { i18n } = useTranslation('dialogs');

  // Initial load effect
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

  // Settings loaded tracking (requires access to settings store state)
  // This should be called with the current loading state from the settings store
  const markSettingsLoaded = (isLoading: boolean, alreadyLoaded: boolean) => {
    useEffect(() => {
      if (!isLoading && !alreadyLoaded) {
        setSettingsHaveLoaded(true);
      }
    }, [isLoading, alreadyLoaded]);
    return settingsHaveLoaded;
  };

  // First-run onboarding detection
  const handleOnboarding = (onboardingCompleted: boolean | undefined, alreadyLoaded: boolean) => {
    useEffect(() => {
      if (alreadyLoaded && onboardingCompleted === false) {
        // Return a flag that the parent component can use to show onboarding
        return true;
      }
    }, [alreadyLoaded, onboardingCompleted]);
    return false;
  };

  // Sync i18n language with settings
  useEffect(() => {
    const handleLanguageChange = (language: string) => {
      if (language && language !== i18n.language) {
        i18n.changeLanguage(language);
      }
    };

    // This will be called by the parent component when settings change
    return () => {};
  }, [i18n]);

  return {
    settingsHaveLoaded,
    markSettingsLoaded,
    handleOnboarding
  };
}

/**
 * Hook to handle app update listener
 */
export function useAppUpdateListener(onUpdateReady: () => void) {
  useEffect(() => {
    // When an update is downloaded and ready to install, trigger callback
    const cleanupDownloaded = window.electronAPI.onAppUpdateDownloaded(() => {
      console.warn('[useAppUpdateListener] Update downloaded, opening settings to updates section');
      onUpdateReady();
    });

    return () => {
      cleanupDownloaded();
    };
  }, [onUpdateReady]);
}

/**
 * Hook to handle open-app-settings event listener
 */
export function useAppSettingsListener(onOpenSettings: (section?: string) => void) {
  useEffect(() => {
    const handleOpenAppSettings = (event: Event) => {
      const customEvent = event as CustomEvent<string>;
      const section = customEvent.detail;
      onOpenSettings(section);
    };

    window.addEventListener('open-app-settings', handleOpenAppSettings);
    return () => {
      window.removeEventListener('open-app-settings', handleOpenAppSettings);
    };
  }, [onOpenSettings]);
}

/**
 * Hook to handle task update on tasks change
 */
export function useTaskUpdateEffect(tasks: any[], selectedTask: any, setSelectedTask: (task: any) => void) {
  useEffect(() => {
    if (selectedTask) {
      const updatedTask = tasks.find(
        (t) => t.id === selectedTask.id || t.specId === selectedTask.specId
      );
      if (updatedTask && updatedTask !== selectedTask) {
        setSelectedTask(updatedTask);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps -- Intentionally omit selectedTask object to prevent infinite re-render loop
  }, [tasks, selectedTask?.id, selectedTask?.specId]);
}

/**
 * Hook to handle terminals restoration on project change
 */
export function useTerminalRestoreEffect(
  selectedProject: Project | null,
  restoreTerminalSessions: (path: string) => Promise<void>
) {
  useEffect(() => {
    // Handle terminals on project change - DON'T destroy, just restore if needed
    // Terminals are now filtered by projectPath in TerminalGrid, so each project
    // sees only its own terminals. PTY processes stay alive across project switches.
    if (selectedProject?.path) {
      restoreTerminalSessions(selectedProject.path).catch((err) => {
        console.error('[useTerminalRestoreEffect] Failed to restore sessions:', err);
      });
    }
  }, [selectedProject?.path, selectedProject?.name, restoreTerminalSessions]);
}

/**
 * Hook to handle task loading on project change
 */
export function useTaskLoadEffect(
  activeProjectId: string | null,
  selectedProjectId: string | null,
  loadTasks: (projectId: string) => void,
  clearTasks: () => void,
  setSelectedTask: (task: null) => void
) {
  useEffect(() => {
    const currentProjectId = activeProjectId || selectedProjectId;
    if (currentProjectId) {
      loadTasks(currentProjectId);
      setSelectedTask(null); // Clear selection on project change
    } else {
      clearTasks();
    }
  }, [activeProjectId, selectedProjectId, loadTasks, clearTasks, setSelectedTask]);
}

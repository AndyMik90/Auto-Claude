import { useState, useEffect } from 'react';
import type { Project } from '@shared/types';
import { initializeProject } from '@/stores/project-store';

/**
 * Hook to handle project initialization flow
 */
export function useAppInitialization(selectedProject: Project | null) {
  const [state, setState] = useState<{
    pendingProject: Project | null;
    isInitializing: boolean;
    initSuccess: boolean;
    initError: string | null;
    skippedInitProjectId: string | null;
    gitHubSetupProject: Project | null;
  }>({
    pendingProject: null,
    isInitializing: false,
    initSuccess: false,
    initError: null,
    skippedInitProjectId: null,
    gitHubSetupProject: null,
  });

  // Reset init success flag when selected project changes
  // This allows the init dialog to show for new/different projects
  useEffect(() => {
    setState(prev => ({
      ...prev,
      initSuccess: false,
      initError: null,
    }));
  }, [selectedProject?.id]);

  // Check if selected project needs initialization (e.g., .auto-claude folder was deleted)
  useEffect(() => {
    // Don't show dialog while initialization is in progress
    if (state.isInitializing) return;

    // Don't reopen dialog after successful initialization
    // (project update with autoBuildPath may not have propagated yet)
    if (state.initSuccess) return;

    if (selectedProject && !selectedProject.autoBuildPath && state.skippedInitProjectId !== selectedProject.id) {
      // Project exists but isn't initialized - show init dialog
      setState(prev => ({
        ...prev,
        pendingProject: selectedProject,
        initError: null, // Clear any previous errors
        initSuccess: false, // Reset success flag
      }));
    }
  }, [selectedProject, state.skippedInitProjectId, state.isInitializing, state.initSuccess]);

  const handleInitialize = async (): Promise<boolean> => {
    if (!state.pendingProject) return false;

    const projectId = state.pendingProject.id;
    console.log('[useAppInitialization] Starting initialization for project:', projectId);
    setState(prev => ({ ...prev, isInitializing: true, initSuccess: false, initError: null }));

    try {
      const result = await initializeProject(projectId);
      console.log('[useAppInitialization] Initialization result:', result);

      if (result?.success) {
        console.log('[useAppInitialization] Initialization successful');
        // Get the updated project from store
        const { projects } = require('../../stores/project-store');
        const updatedProject = projects().find((p: Project) => p.id === projectId);
        console.log('[useAppInitialization] Updated project:', updatedProject);

        // Mark as successful to prevent onOpenChange from treating this as a skip
        setState(prev => ({
          ...prev,
          isInitializing: false,
          initSuccess: true,
          gitHubSetupProject: updatedProject || null,
          pendingProject: null,
        }));
        return true;
      } else {
        // Initialization failed - show error but keep dialog open
        console.log('[useAppInitialization] Initialization failed, showing error');
        const errorMessage = result?.error || 'Failed to initialize Auto Claude. Please try again.';
        setState(prev => ({
          ...prev,
          isInitializing: false,
          initError: errorMessage,
        }));
        return false;
      }
    } catch (error) {
      // Unexpected error occurred
      console.error('[useAppInitialization] Unexpected error during initialization:', error);
      const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred';
      setState(prev => ({
        ...prev,
        isInitializing: false,
        initError: errorMessage,
      }));
      return false;
    }
  };

  const handleSkipInit = () => {
    console.log('[useAppInitialization] User skipped initialization');
    if (state.pendingProject) {
      setState(prev => ({
        ...prev,
        skippedInitProjectId: state.pendingProject!.id,
        pendingProject: null,
        initError: null, // Clear any error when skipping
        initSuccess: false, // Reset success flag
      }));
    }
  };

  const handleGitHubSetupComplete = () => {
    setState(prev => ({
      ...prev,
      gitHubSetupProject: null,
    }));
  };

  const handleGitHubSetupSkip = () => {
    setState(prev => ({
      ...prev,
      gitHubSetupProject: null,
    }));
  };

  return {
    ...state,
    handleInitialize,
    handleSkipInit,
    handleGitHubSetupComplete,
    handleGitHubSetupSkip,
  };
}

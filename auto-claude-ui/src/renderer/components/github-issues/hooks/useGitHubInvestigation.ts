import { useEffect, useCallback } from 'react';
import { useGitHubStore, investigateGitHubIssue } from '../../../stores/github-store';
import type { GitHubIssue } from '../../../../shared/types';

export function useGitHubInvestigation(projectId: string | undefined) {
  const {
    investigationStatus,
    lastInvestigationResult,
    setInvestigationStatus,
    setInvestigationResult,
    setError
  } = useGitHubStore();

  // Set up event listeners for investigation progress
  useEffect(() => {
    if (!projectId) return;

    const cleanupProgress = window.electronAPI.onGitHubInvestigationProgress(
      (eventProjectId, status) => {
        if (eventProjectId === projectId) {
          setInvestigationStatus(status);
        }
      }
    );

    const cleanupComplete = window.electronAPI.onGitHubInvestigationComplete(
      (eventProjectId, result) => {
        if (eventProjectId === projectId) {
          setInvestigationResult(result);
        }
      }
    );

    const cleanupError = window.electronAPI.onGitHubInvestigationError(
      (eventProjectId, error) => {
        if (eventProjectId === projectId) {
          setError(error);
          setInvestigationStatus({
            phase: 'error',
            progress: 0,
            message: error
          });
        }
      }
    );

    return () => {
      cleanupProgress();
      cleanupComplete();
      cleanupError();
    };
  }, [projectId, setInvestigationStatus, setInvestigationResult, setError]);

  const startInvestigation = useCallback((issue: GitHubIssue) => {
    if (projectId) {
      investigateGitHubIssue(projectId, issue.number);
    }
  }, [projectId]);

  const resetInvestigationStatus = useCallback(() => {
    setInvestigationStatus({ phase: 'idle', progress: 0, message: '' });
  }, [setInvestigationStatus]);

  return {
    investigationStatus,
    lastInvestigationResult,
    startInvestigation,
    resetInvestigationStatus
  };
}

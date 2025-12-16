/**
 * Hook for loading Linear issues for a selected team/project
 */

import { useState, useEffect } from 'react';
import type { LinearIssue } from '../types';

export function useLinearIssues(
  projectId: string,
  selectedTeamId: string,
  selectedProjectId: string,
  onIssuesChange?: () => void
) {
  const [issues, setIssues] = useState<LinearIssue[]>([]);
  const [isLoadingIssues, setIsLoadingIssues] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadIssues = async () => {
      if (!selectedTeamId) {
        setIssues([]);
        return;
      }

      setIsLoadingIssues(true);
      setError(null);

      try {
        const result = await window.electronAPI.getLinearIssues(
          projectId,
          selectedTeamId,
          selectedProjectId || undefined
        );
        if (result.success && result.data) {
          setIssues(result.data);
          onIssuesChange?.();
        } else {
          setError(result.error || 'Failed to load issues');
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setIsLoadingIssues(false);
      }
    };

    loadIssues();
  }, [projectId, selectedTeamId, selectedProjectId]);

  return { issues, isLoadingIssues, error, setError };
}

import { useEffect, useCallback } from 'react';
import { useGitHubStore, loadGitHubIssues, checkGitHubConnection } from '../../../stores/github-store';
import type { FilterState } from '../types';

export function useGitHubIssues(projectId: string | undefined) {
  const {
    issues,
    syncStatus,
    isLoading,
    error,
    selectedIssueNumber,
    filterState,
    selectIssue,
    setFilterState,
    getFilteredIssues,
    getOpenIssuesCount
  } = useGitHubStore();

  // Load issues when project changes
  useEffect(() => {
    if (projectId) {
      checkGitHubConnection(projectId);
      loadGitHubIssues(projectId, filterState);
    }
  }, [projectId, filterState]);

  const handleRefresh = useCallback(() => {
    if (projectId) {
      loadGitHubIssues(projectId, filterState);
    }
  }, [projectId, filterState]);

  const handleFilterChange = useCallback((state: FilterState) => {
    setFilterState(state);
    if (projectId) {
      loadGitHubIssues(projectId, state);
    }
  }, [projectId, setFilterState]);

  return {
    issues,
    syncStatus,
    isLoading,
    error,
    selectedIssueNumber,
    filterState,
    selectIssue,
    getFilteredIssues,
    getOpenIssuesCount,
    handleRefresh,
    handleFilterChange
  };
}

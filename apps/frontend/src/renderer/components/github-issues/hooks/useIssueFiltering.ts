import { useState, useMemo, useCallback, useEffect } from 'react';
import type { GitHubIssue } from '../../../../shared/types';
import { filterIssuesBySearch } from '../utils';

interface UseIssueFilteringOptions {
  onSearchStart?: () => void;
  onSearchClear?: () => void;
}

export function useIssueFiltering(
  issues: GitHubIssue[],
  options: UseIssueFilteringOptions = {}
) {
  const { onSearchStart, onSearchClear } = options;
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRepos, setSelectedRepos] = useState<string[]>([]);

  // Derive unique repositories from issues
  const repositories = useMemo(() => {
    const repoSet = new Set<string>();
    issues.forEach(issue => {
      if (issue.repoFullName) {
        repoSet.add(issue.repoFullName);
      }
    });
    return Array.from(repoSet).sort((a, b) =>
      a.toLowerCase().localeCompare(b.toLowerCase())
    );
  }, [issues]);

  const filteredIssues = useMemo(() => {
    let result = filterIssuesBySearch(issues, searchQuery);

    // Apply repository filter
    if (selectedRepos.length > 0) {
      result = result.filter(issue =>
        issue.repoFullName && selectedRepos.includes(issue.repoFullName)
      );
    }

    return result;
  }, [issues, searchQuery, selectedRepos]);

  // Notify when search becomes active or inactive
  useEffect(() => {
    if (searchQuery.length > 0) {
      onSearchStart?.();
    } else {
      onSearchClear?.();
    }
  }, [searchQuery, onSearchStart, onSearchClear]);

  const handleSearchChange = useCallback((query: string) => {
    setSearchQuery(query);
  }, []);

  const isSearchActive = searchQuery.length > 0;

  const handleReposChange = useCallback((repos: string[]) => {
    setSelectedRepos(repos);
  }, []);

  const clearFilters = useCallback(() => {
    setSearchQuery('');
    setSelectedRepos([]);
  }, []);

  const hasActiveFilters = searchQuery.length > 0 || selectedRepos.length > 0;

  return {
    searchQuery,
    setSearchQuery: handleSearchChange,
    filteredIssues,
    isSearchActive,
    repositories,
    selectedRepos,
    setSelectedRepos: handleReposChange,
    clearFilters,
    hasActiveFilters,
  };
}

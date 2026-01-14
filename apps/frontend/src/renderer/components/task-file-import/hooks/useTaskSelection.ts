/**
 * useTaskSelection - Hook for managing task selection state
 *
 * Adapted from useIssueSelection pattern in linear-import
 * Provides selection controls for bulk task import
 */

import { useState, useCallback, useMemo } from 'react';
import type { ParsedTask } from '../types';

interface UseTaskSelectionReturn {
  selectedTaskIds: Set<string>;
  setSelectedTaskIds: React.Dispatch<React.SetStateAction<Set<string>>>;
  selectionControls: {
    selectAll: () => void;
    deselectAll: () => void;
    toggleTask: (id: string) => void;
    isAllSelected: boolean;
    isSomeSelected: boolean;
  };
}

export function useTaskSelection(tasks: ParsedTask[]): UseTaskSelectionReturn {
  const [selectedTaskIds, setSelectedTaskIds] = useState<Set<string>>(new Set());

  // Only consider valid tasks for selection
  const validTasks = useMemo(() => tasks.filter(t => t.isValid), [tasks]);

  const selectAll = useCallback(() => {
    setSelectedTaskIds(new Set(validTasks.map(t => t.parseId)));
  }, [validTasks]);

  const deselectAll = useCallback(() => {
    setSelectedTaskIds(new Set());
  }, []);

  const toggleTask = useCallback((id: string) => {
    setSelectedTaskIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const isAllSelected = useMemo(() => {
    if (validTasks.length === 0) return false;
    return validTasks.every(t => selectedTaskIds.has(t.parseId));
  }, [validTasks, selectedTaskIds]);

  const isSomeSelected = useMemo(() => {
    return selectedTaskIds.size > 0;
  }, [selectedTaskIds]);

  const selectionControls = useMemo(() => ({
    selectAll,
    deselectAll,
    toggleTask,
    isAllSelected,
    isSomeSelected
  }), [selectAll, deselectAll, toggleTask, isAllSelected, isSomeSelected]);

  return {
    selectedTaskIds,
    setSelectedTaskIds,
    selectionControls
  };
}

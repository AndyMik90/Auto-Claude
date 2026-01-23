import { useEffect, useState, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  GitBranch,
  RefreshCw,
  Trash2,
  Loader2,
  AlertCircle,
  FolderOpen,
  FolderGit,
  GitMerge,
  GitPullRequest,
  FileCode,
  FilePlus,
  FilePen,
  FileX,
  Plus,
  Minus,
  ChevronRight,
  Check,
  X,
  Terminal,
  Upload,
  CheckSquare2,
  CheckSquare,
  Square
} from 'lucide-react';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Checkbox } from './ui/checkbox';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './ui/card';
import { ScrollArea } from './ui/scroll-area';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from './ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select';
import { Badge } from './ui/badge';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle
} from './ui/alert-dialog';
import { useProjectStore } from '../stores/project-store';
import { useTaskStore } from '../stores/task-store';
import type { WorktreeListItem, WorktreeMergeResult, TerminalWorktreeConfig, WorktreeStatus, Task, WorktreeCreatePROptions, WorktreeCreatePRResult, IPCResult, WorktreeListResult, WorktreeDiscardResult } from '../../shared/types';
import { CreatePRDialog } from './task-detail/task-review/CreatePRDialog';
import { isWeb as isWebPlatform } from '../../shared/platform';

// Prefix constants for worktree ID parsing
const TASK_PREFIX = 'task:';
const TERMINAL_PREFIX = 'terminal:';

interface WorktreesProps {
  projectId: string;
}

function renderMergeDiff(diff: string) {
  if (!diff) {
    return <div className="text-xs text-muted-foreground">Select a file to view changes.</div>;
  }

  const lines = diff.split('\n');
  return (
    <div className="text-xs font-mono leading-relaxed">
      {lines.map((line, idx) => {
        let lineClass = 'px-2 py-0.5';

        if (line.startsWith('+++') || line.startsWith('---')) {
          lineClass += ' text-muted-foreground bg-muted/30';
        } else if (line.startsWith('@@')) {
          lineClass += ' text-purple-400 bg-purple-500/10';
        } else if (line.startsWith('+')) {
          lineClass += ' text-green-400 bg-green-500/10';
        } else if (line.startsWith('-')) {
          lineClass += ' text-red-400 bg-red-500/10';
        } else if (line.startsWith('diff --git')) {
          lineClass += ' text-muted-foreground font-medium border-t border-border mt-2 pt-2';
        }

        return (
          <div key={`${idx}-${line}`} className={lineClass}>
            {line}
          </div>
        );
      })}
    </div>
  );
}

export function Worktrees({ projectId }: WorktreesProps) {
  const { t } = useTranslation(['common', 'dialogs']);
  const projects = useProjectStore((state) => state.projects);
  const selectedProject = projects.find((p) => p.id === projectId);
  const tasks = useTaskStore((state) => state.tasks);
  const isWeb =
    isWebPlatform() ||
    (typeof window !== 'undefined' &&
      (window.location?.protocol?.startsWith('http') ||
        (window as any).electronAPI?.platform === 'web' ||
        (window as any).electronAPI?.isElectron === false));

  const [worktrees, setWorktrees] = useState<WorktreeListItem[]>([]);
  const [terminalWorktrees, setTerminalWorktrees] = useState<TerminalWorktreeConfig[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [availableBranches, setAvailableBranches] = useState<string[]>([]);
  const [mergeBaseBranch, setMergeBaseBranch] = useState<string>('');
  const [mergePreviewCounts, setMergePreviewCounts] = useState<{
    commits: number;
    files: number;
  } | null>(null);
  const [mergePreviewFiles, setMergePreviewFiles] = useState<Array<{ status: string; path: string }>>([]);
  const [mergePreviewDiff, setMergePreviewDiff] = useState<string>('');
  const [mergePreviewSelectedFile, setMergePreviewSelectedFile] = useState<string>('');
  const [mergePreviewLoading, setMergePreviewLoading] = useState(false);

  const normalizeWorktreeItem = (worktree: any): WorktreeListItem => {
    const normalized = {
      specName: worktree.spec_name ?? worktree.specName ?? '',
      path: worktree.path ?? '',
      branch: worktree.branch ?? '',
      baseBranch: worktree.base_branch ?? worktree.baseBranch ?? '',
      commitCount: worktree.commit_count ?? worktree.commitCount ?? 0,
      filesChanged: worktree.files_changed ?? worktree.filesChanged ?? 0,
      additions: worktree.additions ?? 0,
      deletions: worktree.deletions ?? 0,
    };
    console.log('[Worktrees] Normalized worktree:', { original: worktree, normalized });
    return normalized;
  };

  const listWorktreesWeb = async (id: string): Promise<IPCResult<WorktreeListResult>> => {
    const response = await fetch(`/api/projects/${id}/worktrees`, {
      headers: { 'Content-Type': 'application/json' },
    });

    if (!response.ok) {
      const error = await response.text();
      return { success: false, error };
    }

    const payload = await response.json();
    if (!payload?.success || !payload?.data) {
      return payload;
    }

    const normalized = (payload.data.worktrees || []).map(normalizeWorktreeItem);
    return { success: true, data: { worktrees: normalized } };
  };

  const listBranchesWeb = async (projectPath: string): Promise<string[]> => {
    if (!projectPath) {
      return [];
    }

    const response = await fetch(
      `/api/git/branches?path=${encodeURIComponent(projectPath)}`,
      { headers: { 'Content-Type': 'application/json' } }
    );

    if (!response.ok) {
      return [];
    }

    const payload = await response.json();
    if (!payload?.success || !payload?.data) {
      return [];
    }

    return (payload.data as string[]).map((branch) => branch.trim()).filter(Boolean);
  };

  const getCurrentBranchWeb = async (projectPath: string): Promise<string> => {
    if (!projectPath) {
      return '';
    }

    const response = await fetch(
      `/api/git/current-branch?path=${encodeURIComponent(projectPath)}`,
      { headers: { 'Content-Type': 'application/json' } }
    );

    if (!response.ok) {
      return '';
    }

    const payload = await response.json();
    if (!payload?.success || !payload?.data) {
      return '';
    }

    return String(payload.data || '');
  };

  const mergeWorktreePreviewWeb = async (
    id: string,
    specName: string,
    baseBranch?: string
  ): Promise<IPCResult<{ preview: { commit_count?: number; files?: Array<{ status: string; path: string }> } | null }>> => {
    const query = baseBranch ? `?base_branch=${encodeURIComponent(baseBranch)}` : '';
    const response = await fetch(
      `/api/projects/${id}/worktrees/${specName}/merge-preview${query}`,
      { headers: { 'Content-Type': 'application/json' } }
    );

    if (!response.ok) {
      const error = await response.text();
      return { success: false, error };
    }

    return response.json();
  };

  const mergeWorktreeFileDiffWeb = async (
    projectIdValue: string,
    specName: string,
    filePath: string,
    baseBranch?: string
  ): Promise<IPCResult<string>> => {
    const params = new URLSearchParams({ file_path: filePath });
    if (baseBranch) {
      params.append('base_branch', baseBranch);
    }

    const response = await fetch(
      `/api/projects/${projectIdValue}/tasks/${specName}/git-diff?${params.toString()}`,
      { headers: { 'Content-Type': 'application/json' } }
    );

    if (!response.ok) {
      const error = await response.text();
      return { success: false, error };
    }

    const payload = await response.json();
    if (!payload?.success) {
      return { success: false, error: payload?.error || 'Failed to load diff' };
    }

    return { success: true, data: payload.data?.diff || '' };
  };

  const mergeWorktreeWeb = async (
    id: string,
    specName: string,
    baseBranch?: string
  ): Promise<IPCResult<WorktreeMergeResult>> => {
    const response = await fetch(`/api/projects/${id}/worktrees/${specName}/merge`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        delete_after: false,
        no_commit: false,
        base_branch: baseBranch || undefined,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      return { success: false, error };
    }

    const payload = await response.json();
    if (!payload?.success) {
      return { success: false, error: payload?.error || 'Merge failed' };
    }

    const message = payload?.data?.message || 'Merge completed';
    return {
      success: true,
      data: {
        success: true,
        message,
      },
    };
  };

  const discardWorktreeWeb = async (id: string, specName: string): Promise<IPCResult<WorktreeDiscardResult>> => {
    const response = await fetch(`/api/projects/${id}/worktrees/${specName}?delete_branch=true`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
    });

    if (!response.ok) {
      const error = await response.text();
      return { success: false, error };
    }

    const payload = await response.json();
    if (!payload?.success) {
      return { success: false, error: payload?.error || 'Delete failed' };
    }

    const message = payload?.data?.message || 'Worktree discarded successfully';
    return {
      success: true,
      data: {
        success: true,
        message,
      },
    };
  };
  const [error, setError] = useState<string | null>(null);

  // Terminal worktree delete state
  const [terminalWorktreeToDelete, setTerminalWorktreeToDelete] = useState<TerminalWorktreeConfig | null>(null);
  const [isDeletingTerminal, setIsDeletingTerminal] = useState(false);

  // Merge dialog state
  const [showMergeDialog, setShowMergeDialog] = useState(false);
  const [selectedWorktree, setSelectedWorktree] = useState<WorktreeListItem | null>(null);
  const [isMerging, setIsMerging] = useState(false);
  const [mergeResult, setMergeResult] = useState<WorktreeMergeResult | null>(null);

  // Delete confirmation state
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [worktreeToDelete, setWorktreeToDelete] = useState<WorktreeListItem | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Bulk delete confirmation state
  const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = useState(false);
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);

  // Create PR dialog state
  const [showCreatePRDialog, setShowCreatePRDialog] = useState(false);
  const [prWorktree, setPrWorktree] = useState<WorktreeListItem | null>(null);
  const [prTask, setPrTask] = useState<Task | null>(null);

  // Selection state
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedWorktreeIds, setSelectedWorktreeIds] = useState<Set<string>>(new Set());

  // Selection callbacks
  const toggleWorktree = useCallback((id: string) => {
    setSelectedWorktreeIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const selectAll = useCallback(() => {
    const allIds = [
      ...worktrees.map(w => `${TASK_PREFIX}${w.specName}`),
      ...terminalWorktrees.map(wt => `${TERMINAL_PREFIX}${wt.name}`)
    ];
    setSelectedWorktreeIds(new Set(allIds));
  }, [worktrees, terminalWorktrees]);

  const deselectAll = useCallback(() => {
    setSelectedWorktreeIds(new Set());
  }, []);

  // Computed selection values
  const totalWorktrees = worktrees.length + terminalWorktrees.length;

  const isAllSelected = useMemo(
    () => totalWorktrees > 0 &&
      worktrees.every(w => selectedWorktreeIds.has(`${TASK_PREFIX}${w.specName}`)) &&
      terminalWorktrees.every(wt => selectedWorktreeIds.has(`${TERMINAL_PREFIX}${wt.name}`)),
    [worktrees, terminalWorktrees, selectedWorktreeIds, totalWorktrees]
  );

  const isSomeSelected = useMemo(
    () => (
      worktrees.some(w => selectedWorktreeIds.has(`${TASK_PREFIX}${w.specName}`)) ||
      terminalWorktrees.some(wt => selectedWorktreeIds.has(`${TERMINAL_PREFIX}${wt.name}`))
    ) && !isAllSelected,
    [worktrees, terminalWorktrees, selectedWorktreeIds, isAllSelected]
  );

  // Compute selectedCount by filtering against current worktrees to exclude stale selections
  const selectedCount = useMemo(() => {
    const validTaskIds = new Set(worktrees.map(w => `${TASK_PREFIX}${w.specName}`));
    const validTerminalIds = new Set(terminalWorktrees.map(wt => `${TERMINAL_PREFIX}${wt.name}`));
    let count = 0;
    selectedWorktreeIds.forEach(id => {
      if (validTaskIds.has(id) || validTerminalIds.has(id)) {
        count++;
      }
    });
    return count;
  }, [worktrees, terminalWorktrees, selectedWorktreeIds]);

  // Load worktrees (both task and terminal worktrees)
  const loadWorktrees = useCallback(async () => {
    if (!projectId || !selectedProject) return;

    // Clear selection when refreshing list to prevent stale selections
    setSelectedWorktreeIds(new Set());
    setIsSelectionMode(false);

    setIsLoading(true);
    setError(null);

    try {
      if (isWeb) {
        // Web mode: only load from web API
        console.log('[Worktrees] Loading worktrees from web API for project:', projectId);
        const taskResult = await listWorktreesWeb(projectId);
        console.log('[Worktrees] Web API worktrees result:', taskResult);

        if (taskResult.success && taskResult.data) {
          setWorktrees(taskResult.data.worktrees);
        } else {
          setError(taskResult.error || 'Failed to load worktrees');
        }
        // In web mode, we don't have terminal worktrees
        setTerminalWorktrees([]);
      } else {
        // Electron mode: fetch both task worktrees and terminal worktrees in parallel
        const [taskResult, terminalResult] = await Promise.all([
          window.electronAPI.listWorktrees(projectId),
          window.electronAPI.listTerminalWorktrees(selectedProject.path)
        ]);

        console.log('[Worktrees] Task worktrees result:', taskResult);
        console.log('[Worktrees] Terminal worktrees result:', terminalResult);

        if (taskResult.success && taskResult.data) {
          setWorktrees(taskResult.data.worktrees);
        } else {
          setError(taskResult.error || 'Failed to load task worktrees');
        }

        if (terminalResult.success && terminalResult.data) {
          console.log('[Worktrees] Setting terminal worktrees:', terminalResult.data);
          setTerminalWorktrees(terminalResult.data);
        } else {
          console.warn('[Worktrees] Terminal worktrees fetch failed or empty:', terminalResult);
        }
      }
    } catch (err) {
      console.error('[Worktrees] Error loading worktrees:', err);
      setError(err instanceof Error ? err.message : 'Failed to load worktrees');
    } finally {
      setIsLoading(false);
    }
  }, [projectId, selectedProject, isWeb]);

  // Load on mount and when project changes
  useEffect(() => {
    loadWorktrees();
  }, [loadWorktrees]);

  // Find task for a worktree
  const findTaskForWorktree = useCallback((specName: string) => {
    return tasks.find(t => t.specId === specName);
  }, [tasks]);

  // Handle merge
  const handleMerge = async () => {
    console.log('[Worktrees] handleMerge called');
    console.log('[Worktrees] selectedWorktree:', selectedWorktree);
    
    if (!selectedWorktree) {
      console.error('[Worktrees] No selectedWorktree!');
      setMergeResult({
        success: false,
        message: 'No worktree selected'
      });
      return;
    }

    console.log('[Worktrees] selectedWorktree.specName:', selectedWorktree.specName);
    
    const task = findTaskForWorktree(selectedWorktree.specName);
    console.log('[Worktrees] Found task:', task);
    console.log('[Worktrees] isWeb:', isWeb);
    
    if (!task && !isWeb) {
      setError('Task not found for this worktree');
      return;
    }

    setIsMerging(true);
    try {
      const result = await (isWeb
        ? mergeWorktreeWeb(projectId, selectedWorktree.specName, mergeBaseBranch || selectedWorktree.baseBranch)
        : window.electronAPI.mergeWorktree(task!.id));
      
      console.log('[Worktrees] Merge result:', result);
      
      if (result.success && result.data) {
        setMergeResult(result.data);
        if (result.data.success) {
          // Refresh worktrees after successful merge
          await loadWorktrees();
        }
      } else {
        setMergeResult({
          success: false,
          message: result.error || 'Merge failed'
        });
      }
    } catch (err) {
      console.error('[Worktrees] Merge exception:', err);
      setMergeResult({
        success: false,
        message: err instanceof Error ? err.message : 'Merge failed'
      });
    } finally {
      setIsMerging(false);
    }
  };

  // Handle delete
  const handleDelete = async () => {
    if (!worktreeToDelete) return;

    const task = findTaskForWorktree(worktreeToDelete.specName);
    if (!task && !isWeb) {
      setError('Task not found for this worktree');
      return;
    }

    setIsDeleting(true);
    try {
      const result = await (isWeb
        ? discardWorktreeWeb(projectId, worktreeToDelete.specName)
        : window.electronAPI.discardWorktree(task!.id));
      if (result.success) {
        // Refresh worktrees after successful delete
        await loadWorktrees();
        setShowDeleteConfirm(false);
        setWorktreeToDelete(null);
      } else {
        setError(result.error || 'Failed to delete worktree');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete worktree');
    } finally {
      setIsDeleting(false);
    }
  };

  // Open merge dialog
  const openMergeDialog = async (worktree: WorktreeListItem) => {
    console.log('[Worktrees] openMergeDialog called with:', worktree);
    console.log('[Worktrees] isWeb:', isWeb);
    console.log('[Worktrees] projectId:', projectId);
    
    setSelectedWorktree(worktree);
    setMergeResult(null);
    setMergePreviewCounts(null);
    setMergePreviewFiles([]);
    setMergePreviewDiff('');
    setMergePreviewSelectedFile('');
    setShowMergeDialog(true);

    if (isWeb) {
      console.log('[Worktrees] Opening merge dialog for:', worktree);
      const repoPath = worktree.path || selectedProject?.path || '';
      const [branches, currentBranch] = await Promise.all([
        listBranchesWeb(repoPath),
        getCurrentBranchWeb(repoPath),
      ]);
      const preferred = currentBranch || worktree.baseBranch || branches[0] || '';
      console.log('[Worktrees] Available branches:', branches);
      console.log('[Worktrees] Preferred branch:', preferred);
      setAvailableBranches(branches);
      setMergeBaseBranch(preferred);

      const preview = await mergeWorktreePreviewWeb(projectId, worktree.specName, preferred);
      console.log('[Worktrees] Initial preview response:', preview);
      
      if (preview.success && preview.data?.preview) {
        const files = preview.data.preview.files || [];
        console.log('[Worktrees] Initial files:', files);
        setMergePreviewFiles(files);
        setMergePreviewCounts({
          commits: preview.data.preview.commit_count ?? worktree.commitCount,
          files: files.length || worktree.filesChanged,
        });
      } else {
        console.warn('[Worktrees] Initial preview failed or empty:', preview);
      }
      return;
    }

    setAvailableBranches([]);
    setMergeBaseBranch(worktree.baseBranch);
  };

  // Confirm delete
  const confirmDelete = (worktree: WorktreeListItem) => {
    setWorktreeToDelete(worktree);
    setShowDeleteConfirm(true);
  };

  // Convert WorktreeListItem to WorktreeStatus for the dialog
  const worktreeToStatus = (worktree: WorktreeListItem): WorktreeStatus => ({
    exists: true,
    worktreePath: worktree.path,
    branch: worktree.branch,
    baseBranch: worktree.baseBranch,
    commitCount: worktree.commitCount,
    filesChanged: worktree.filesChanged,
    additions: worktree.additions,
    deletions: worktree.deletions
  });

  // Open Create PR dialog
  const openCreatePRDialog = (worktree: WorktreeListItem, task: Task) => {
    setPrWorktree(worktree);
    setPrTask(task);
    setShowCreatePRDialog(true);
  };

  // Handle Create PR
  const handleCreatePR = async (options: WorktreeCreatePROptions): Promise<WorktreeCreatePRResult | null> => {
    if (!prTask || !prWorktree) return null;

    try {
      if (isWeb) {
        // Web mode: use API
        console.log('[Worktrees] Creating PR via web API');

        const response = await fetch(
          `/api/projects/${projectId}/worktrees/${prWorktree.specName}/create-pr`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              target_branch: options.targetBranch,
              title: options.title,
              draft: options.draft,
              force_push: options.forcePush
            })
          }
        );

        if (!response.ok) {
          const error = await response.text();
          return {
            success: false,
            error,
            prUrl: undefined,
            alreadyExists: false
          };
        }

        const result = await response.json();
        if (result.success && result.data) {
          if (result.data.success && result.data.prUrl && !result.data.alreadyExists) {
            // Update task in store
            useTaskStore.getState().updateTask(prTask.id, {
              status: 'pr_created',
              metadata: { ...prTask.metadata, prUrl: result.data.prUrl }
            });
          }
          return {
            success: result.data.success,
            error: result.data.error,
            prUrl: result.data.prUrl,
            alreadyExists: result.data.alreadyExists
          };
        }
        return {
          success: false,
          error: result.error || 'Failed to create PR',
          prUrl: undefined,
          alreadyExists: false
        };
      } else {
        // Electron mode: use IPC
        const result = await window.electronAPI.createWorktreePR(prTask.id, options);
        if (result.success && result.data) {
          if (result.data.success && result.data.prUrl && !result.data.alreadyExists) {
            // Update task in store
            useTaskStore.getState().updateTask(prTask.id, {
              status: 'pr_created',
              metadata: { ...prTask.metadata, prUrl: result.data.prUrl }
            });
          }
          return result.data;
        }
        // Propagate IPC error; let CreatePRDialog use its i18n fallback
        return { success: false, error: result.error, prUrl: undefined, alreadyExists: false };
      }
    } catch (err) {
      console.error('[Worktrees] Create PR error:', err);
      // Propagate actual error message; let CreatePRDialog handle i18n fallback for undefined
      return { success: false, error: err instanceof Error ? err.message : undefined, prUrl: undefined, alreadyExists: false };
    }
  };

  // Handle Publish Branch
  const handlePublishBranch = async (worktree: WorktreeListItem) => {
    console.log('[Worktrees] Publishing branch for worktree:', worktree.specName);
    
    setIsPublishingBranch(true);
    setPublishingWorktreeId(worktree.specName);

    try {
      if (isWeb) {
        // Web mode: use API
        const response = await fetch(
          `/api/projects/${projectId}/worktrees/${worktree.specName}/publish-branch`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              force_push: false
            })
          }
        );

        const result = await response.json();
        
        if (result.success && result.data?.success) {
          console.log('[Worktrees] Branch published successfully');
        } else {
          console.error('[Worktrees] Failed to publish branch:', result.data?.error || result.error);
          setError(result.data?.error || result.error || 'Failed to publish branch');
        }
      } else {
        // Electron mode: use IPC
        // Note: You'll need to add this IPC method to the electron API
        console.warn('[Worktrees] Publish branch not yet implemented for Electron mode');
        setError('Publish branch is only available in web mode');
      }
    } catch (err) {
      console.error('[Worktrees] Publish branch error:', err);
      setError(err instanceof Error ? err.message : 'Failed to publish branch');
    } finally {
      setIsPublishingBranch(false);
      setPublishingWorktreeId(null);
    }
  };
  // Handle bulk delete - triggered from selection bar
  const handleBulkDelete = useCallback(() => {
    if (selectedWorktreeIds.size === 0) return;
    setShowBulkDeleteConfirm(true);
  }, [selectedWorktreeIds]);

  // Execute bulk delete - called when user confirms in dialog
  const executeBulkDelete = useCallback(async () => {
    if (selectedWorktreeIds.size === 0 || !selectedProject) return;

    setIsBulkDeleting(true);
    const errors: string[] = [];

    // Parse selected IDs and separate by type
    const taskSpecNames: string[] = [];
    const terminalNames: string[] = [];

    selectedWorktreeIds.forEach((id) => {
      if (id.startsWith(TASK_PREFIX)) {
        taskSpecNames.push(id.slice(TASK_PREFIX.length));
      } else if (id.startsWith(TERMINAL_PREFIX)) {
        terminalNames.push(id.slice(TERMINAL_PREFIX.length));
      }
    });

    // Delete task worktrees
    for (const specName of taskSpecNames) {
      const task = findTaskForWorktree(specName);
      if (!task) {
        errors.push(t('common:errors.taskNotFoundForWorktree', { specName }));
        continue;
      }

      try {
        const result = await window.electronAPI.discardWorktree(task.id);
        if (!result.success) {
          errors.push(result.error || t('common:errors.failedToDeleteTaskWorktree', { specName }));
        }
      } catch (err) {
        errors.push(err instanceof Error ? err.message : t('common:errors.failedToDeleteTaskWorktree', { specName }));
      }
    }

    // Delete terminal worktrees
    for (const name of terminalNames) {
      const terminalWt = terminalWorktrees.find((wt) => wt.name === name);
      if (!terminalWt) {
        errors.push(t('common:errors.terminalWorktreeNotFound', { name }));
        continue;
      }

      try {
        const result = await window.electronAPI.removeTerminalWorktree(
          selectedProject.path,
          terminalWt.name,
          terminalWt.hasGitBranch // Delete the branch too if it was created
        );
        if (!result.success) {
          errors.push(result.error || t('common:errors.failedToDeleteTerminalWorktree', { name }));
        }
      } catch (err) {
        errors.push(err instanceof Error ? err.message : t('common:errors.failedToDeleteTerminalWorktree', { name }));
      }
    }

    // Clear selection and refresh list
    setSelectedWorktreeIds(new Set());
    setShowBulkDeleteConfirm(false);
    await loadWorktrees();

    // Show error if any failures occurred
    if (errors.length > 0) {
      setError(`${t('common:errors.bulkDeletePartialFailure')}\n${errors.join('\n')}`);
    }

    setIsBulkDeleting(false);
  }, [selectedWorktreeIds, selectedProject, terminalWorktrees, findTaskForWorktree, loadWorktrees, t]);

  // Handle terminal worktree delete
  const handleDeleteTerminalWorktree = async () => {
    if (!terminalWorktreeToDelete || !selectedProject) return;

    setIsDeletingTerminal(true);
    try {
      const result = await window.electronAPI.removeTerminalWorktree(
        selectedProject.path,
        terminalWorktreeToDelete.name,
        terminalWorktreeToDelete.hasGitBranch // Delete the branch too if it was created
      );
      if (result.success) {
        // Refresh worktrees after successful delete
        await loadWorktrees();
        setTerminalWorktreeToDelete(null);
      } else {
        setError(result.error || 'Failed to delete terminal worktree');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete terminal worktree');
    } finally {
      setIsDeletingTerminal(false);
    }
  };

  if (!selectedProject) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-muted-foreground">Select a project to view worktrees</p>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col p-6">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <GitBranch className="h-6 w-6" />
            Worktrees
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Manage isolated workspaces for your Auto Claude tasks
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant={isSelectionMode ? 'default' : 'outline'}
            size="sm"
            onClick={() => {
              if (isSelectionMode) {
                setIsSelectionMode(false);
                setSelectedWorktreeIds(new Set());
              } else {
                setIsSelectionMode(true);
              }
            }}
          >
            <CheckSquare2 className="h-4 w-4 mr-2" />
            {isSelectionMode ? t('common:selection.done') : t('common:selection.select')}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={loadWorktrees}
            disabled={isLoading}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            {t('common:buttons.refresh')}
          </Button>
        </div>
      </div>

      {/* Selection controls bar - visible when selection mode is enabled */}
      {isSelectionMode && totalWorktrees > 0 && (
        <div className="flex items-center justify-between py-2 mb-4 border-b border-border shrink-0">
          <div className="flex items-center gap-3">
            <button
              onClick={isAllSelected ? deselectAll : selectAll}
              className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
            >
              {/* tri-state icon: isAllSelected -> CheckSquare, isSomeSelected -> Minus, none -> Square */}
              {isAllSelected ? <CheckSquare className="h-4 w-4 text-primary" /> : isSomeSelected ? <Minus className="h-4 w-4" /> : <Square className="h-4 w-4" />}
              {isAllSelected ? t('common:selection.clearSelection') : t('common:selection.selectAll')}
            </button>
            <span className="text-xs text-muted-foreground">
              {t('common:selection.selectedOfTotal', { selected: selectedCount, total: totalWorktrees })}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="destructive"
              size="sm"
              disabled={selectedWorktreeIds.size === 0}
              onClick={handleBulkDelete}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              {t('common:buttons.delete')} ({selectedWorktreeIds.size})
            </Button>
          </div>
        </div>
      )}

      {/* Error message */}
      {error && (
        <div className="mb-4 rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm">
          <div className="flex items-start gap-2">
            <AlertCircle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
            <div>
              <p className="font-medium text-destructive">Error</p>
              <p className="text-muted-foreground mt-1 whitespace-pre-line">{error}</p>
            </div>
          </div>
        </div>
      )}

      {/* Loading state */}
      {isLoading && worktrees.length === 0 && terminalWorktrees.length === 0 && (
        <div className="flex h-full items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      )}

      {/* Empty state */}
      {!isLoading && worktrees.length === 0 && terminalWorktrees.length === 0 && (
        <div className="flex h-full flex-col items-center justify-center text-center">
          <div className="rounded-full bg-muted p-4 mb-4">
            <GitBranch className="h-8 w-8 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-semibold text-foreground">No Worktrees</h3>
          <p className="text-sm text-muted-foreground mt-2 max-w-md">
            Worktrees are created automatically when Auto Claude builds features.
            You can also create terminal worktrees from the Agent Terminals tab.
          </p>
        </div>
      )}

      {/* Main content area with scroll */}
      {(worktrees.length > 0 || terminalWorktrees.length > 0) && (
        <ScrollArea className="flex-1 -mx-2">
          <div className="space-y-6 px-2">
            {/* Task Worktrees Section */}
            {worktrees.length > 0 && (
              <div className="space-y-4">
                <h3 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <GitBranch className="h-4 w-4" />
                  Task Worktrees
                </h3>
                {worktrees.map((worktree) => {
                  const task = findTaskForWorktree(worktree.specName);
                  const taskId = `${TASK_PREFIX}${worktree.specName}`;
                  return (
                    <Card key={worktree.specName} className="overflow-hidden">
                      <CardHeader className="pb-3">
                        <div className="flex items-start justify-between">
                          <div className="flex items-start gap-3 flex-1 min-w-0">
                            {isSelectionMode && (
                              <Checkbox
                                checked={selectedWorktreeIds.has(taskId)}
                                onCheckedChange={() => toggleWorktree(taskId)}
                                className="mt-1"
                              />
                            )}
                            <div className="flex-1 min-w-0">
                              <CardTitle className="text-base flex items-center gap-2">
                                <GitBranch className="h-4 w-4 text-info shrink-0" />
                                <span className="truncate">{worktree.branch}</span>
                              </CardTitle>
                              {task && (
                                <CardDescription className="mt-1 truncate">
                                  {task.title}
                                </CardDescription>
                              )}
                            </div>
                          </div>
                          <Badge variant="outline" className="shrink-0 ml-2">
                            {worktree.specName}
                          </Badge>
                        </div>
                      </CardHeader>
                      <CardContent className="pt-0">
                        {/* Stats */}
                        <div className="flex flex-wrap gap-4 text-sm mb-4">
                          <div className="flex items-center gap-1.5 text-muted-foreground">
                            <FileCode className="h-3.5 w-3.5" />
                            <span>{worktree.filesChanged} files changed</span>
                          </div>
                          <div className="flex items-center gap-1.5 text-muted-foreground">
                            <ChevronRight className="h-3.5 w-3.5" />
                            <span>{worktree.commitCount} commits ahead</span>
                          </div>
                          <div className="flex items-center gap-1.5 text-success">
                            <Plus className="h-3.5 w-3.5" />
                            <span>{worktree.additions}</span>
                          </div>
                          <div className="flex items-center gap-1.5 text-destructive">
                            <Minus className="h-3.5 w-3.5" />
                            <span>{worktree.deletions}</span>
                          </div>
                        </div>

                        {/* Branch info */}
                        <div className="flex items-center gap-2 text-xs text-muted-foreground mb-4 bg-muted/50 rounded-md p-2">
                          <span className="font-mono">{worktree.baseBranch}</span>
                          <ChevronRight className="h-3 w-3" />
                          <span className="font-mono text-info">{worktree.branch}</span>
                        </div>

                        {/* Actions */}
                        <div className="flex flex-wrap gap-2">
                          <Button
                            variant="default"
                            size="sm"
                            onClick={() => openMergeDialog(worktree)}
                          >
                            <GitMerge className="h-3.5 w-3.5 mr-1.5" />
                            Merge to {worktree.baseBranch}
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handlePublishBranch(worktree)}
                            disabled={isPublishingBranch && publishingWorktreeId === worktree.specName}
                          >
                            {isPublishingBranch && publishingWorktreeId === worktree.specName ? (
                              <>
                                <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                                Publishing...
                              </>
                            ) : (
                              <>
                                <Upload className="h-3.5 w-3.5 mr-1.5" />
                                Publish Branch
                              </>
                            )}
                          </Button>
                          {task && (
                            <Button
                              variant="info"
                              size="sm"
                              onClick={() => openCreatePRDialog(worktree, task)}
                            >
                              <GitPullRequest className="h-3.5 w-3.5 mr-1.5" />
                              {t('common:buttons.createPR')}
                            </Button>
                          )}
                          {task?.status === 'pr_created' && task.metadata?.prUrl && (
                            <Button
                              variant="info"
                              size="sm"
                              onClick={() => window.electronAPI?.openExternal(task.metadata?.prUrl ?? '')}
                            >
                              <GitPullRequest className="h-3.5 w-3.5 mr-1.5" />
                              {t('common:buttons.openPR')}
                            </Button>
                          )}
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              // Copy worktree path to clipboard
                              navigator.clipboard.writeText(worktree.path);
                            }}
                          >
                            <FolderOpen className="h-3.5 w-3.5 mr-1.5" />
                            Copy Path
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-destructive hover:text-destructive hover:bg-destructive/10"
                            onClick={() => confirmDelete(worktree)}
                            disabled={!task}
                          >
                            <Trash2 className="h-3.5 w-3.5 mr-1.5" />
                            Delete
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}

            {/* Terminal Worktrees Section */}
            {terminalWorktrees.length > 0 && (
              <div className="space-y-4">
                <h3 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <Terminal className="h-4 w-4" />
                  Terminal Worktrees
                </h3>
                {terminalWorktrees.map((wt) => {
                  const terminalId = `${TERMINAL_PREFIX}${wt.name}`;
                  return (
                    <Card key={wt.name} className="overflow-hidden">
                      <CardHeader className="pb-3">
                        <div className="flex items-start justify-between">
                          <div className="flex items-start gap-3 flex-1 min-w-0">
                            {isSelectionMode && (
                              <Checkbox
                                checked={selectedWorktreeIds.has(terminalId)}
                                onCheckedChange={() => toggleWorktree(terminalId)}
                                className="mt-1"
                              />
                            )}
                            <div className="flex-1 min-w-0">
                              <CardTitle className="text-base flex items-center gap-2">
                                <FolderGit className="h-4 w-4 text-amber-500 shrink-0" />
                                <span className="truncate">{wt.name}</span>
                              </CardTitle>
                              {wt.branchName && (
                                <CardDescription className="mt-1 truncate font-mono text-xs">
                                  {wt.branchName}
                                </CardDescription>
                              )}
                            </div>
                          </div>
                          {wt.taskId && (
                            <Badge variant="outline" className="shrink-0 ml-2">
                              {wt.taskId}
                            </Badge>
                          )}
                        </div>
                      </CardHeader>
                    <CardContent className="pt-0">
                      {/* Branch info */}
                      {wt.baseBranch && wt.branchName && (
                        <div className="flex items-center gap-2 text-xs text-muted-foreground mb-4 bg-muted/50 rounded-md p-2">
                          <span className="font-mono">{wt.baseBranch}</span>
                          <ChevronRight className="h-3 w-3" />
                          <span className="font-mono text-amber-500">{wt.branchName}</span>
                        </div>
                      )}

                      {/* Created at */}
                      {wt.createdAt && (
                        <div className="text-xs text-muted-foreground mb-4">
                          Created {new Date(wt.createdAt).toLocaleDateString()}
                        </div>
                      )}

                      {/* Actions */}
                      <div className="flex flex-wrap gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            // Copy worktree path to clipboard
                            navigator.clipboard.writeText(wt.worktreePath);
                          }}
                        >
                          <FolderOpen className="h-3.5 w-3.5 mr-1.5" />
                          Copy Path
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-destructive hover:text-destructive hover:bg-destructive/10"
                          onClick={() => setTerminalWorktreeToDelete(wt)}
                        >
                          <Trash2 className="h-3.5 w-3.5 mr-1.5" />
                          Delete
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                  );
                })}
              </div>
            )}
          </div>
        </ScrollArea>
      )}

      {/* Merge Dialog */}
      <Dialog open={showMergeDialog} onOpenChange={setShowMergeDialog}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <GitMerge className="h-5 w-5" />
              Merge Worktree
            </DialogTitle>
            <DialogDescription>
              Merge changes from this worktree into the base branch.
            </DialogDescription>
          </DialogHeader>

          {selectedWorktree && !mergeResult && (
            <div className="py-4">
              <div className="rounded-lg bg-muted p-4 text-sm space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Source Branch</span>
                  <span className="font-mono text-info">{selectedWorktree.branch}</span>
                </div>
                <div className="flex items-center justify-center">
                  <ChevronRight className="h-4 w-4 text-muted-foreground rotate-90" />
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-muted-foreground">Target Branch</span>
                  {isWeb ? (
                    <Select
                      value={mergeBaseBranch || selectedWorktree.baseBranch}
                      onValueChange={async (value) => {
                        console.log('[Worktrees] Branch changed to:', value);
                        setMergeBaseBranch(value);
                        setMergePreviewCounts(null);
                        setMergePreviewFiles([]);
                        setMergePreviewDiff('');
                        setMergePreviewSelectedFile('');
                        
                        try {
                          const preview = await mergeWorktreePreviewWeb(
                            projectId,
                            selectedWorktree.specName,
                            value
                          );
                          console.log('[Worktrees] Preview response:', preview);
                          
                          if (preview.success && preview.data?.preview) {
                            const files = preview.data.preview.files || [];
                            console.log('[Worktrees] Setting files:', files);
                            setMergePreviewFiles(files);
                            setMergePreviewCounts({
                              commits: preview.data.preview.commit_count ?? selectedWorktree.commitCount,
                              files: files.length || selectedWorktree.filesChanged,
                            });
                          } else {
                            console.warn('[Worktrees] Preview failed or empty:', preview);
                          }
                        } catch (err) {
                          console.error('[Worktrees] Error loading preview:', err);
                        }
                      }}
                    >
                      <SelectTrigger className="h-8 w-48">
                        <SelectValue placeholder="Select branch" />
                      </SelectTrigger>
                      <SelectContent>
                        {(availableBranches.length > 0 ? availableBranches : [selectedWorktree.baseBranch])
                          .filter(Boolean)
                          .map((branch) => (
                            <SelectItem key={branch} value={branch}>
                              {branch}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <span className="font-mono">{selectedWorktree.baseBranch}</span>
                  )}
                </div>
                <div className="border-t border-border pt-3 mt-3">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Changes</span>
                    <span>
                      {(mergePreviewCounts?.commits ?? selectedWorktree.commitCount)} commits, {(mergePreviewCounts?.files ?? selectedWorktree.filesChanged)} files
                    </span>
                  </div>
                </div>

                {isWeb && (
                  <div className="border-t border-border pt-3 mt-3">
                    <div className="mt-3">
                      <div className="grid grid-cols-[220px_1fr] gap-0 border border-border rounded-lg overflow-hidden">
                        <ScrollArea className="h-64 border-r border-border">
                          <div className="p-2 space-y-1">
                            {mergePreviewFiles.length === 0 && (
                              <div className="text-xs text-muted-foreground">No files changed</div>
                            )}
                            {mergePreviewFiles.map((file) => (
                              <button
                                key={file.path}
                                type="button"
                                className={`w-full text-left rounded px-2 py-2 hover:bg-muted ${mergePreviewSelectedFile === file.path ? 'bg-muted' : ''}`}
                                onClick={async () => {
                                  setMergePreviewSelectedFile(file.path);
                                  setMergePreviewLoading(true);
                                  const diff = await mergeWorktreeFileDiffWeb(
                                    projectId,
                                    selectedWorktree.specName,
                                    file.path,
                                    mergeBaseBranch || selectedWorktree.baseBranch
                                  );
                                  if (diff.success && diff.data) {
                                    setMergePreviewDiff(diff.data);
                                  } else {
                                    setMergePreviewDiff(diff.error || 'Failed to load diff');
                                  }
                                  setMergePreviewLoading(false);
                                }}
                              >
                                <div className="flex items-center gap-2">
                                  {file.status === 'added' && <FilePlus className="h-3.5 w-3.5 text-green-500" />}
                                  {file.status === 'modified' && <FilePen className="h-3.5 w-3.5 text-blue-500" />}
                                  {file.status === 'deleted' && <FileX className="h-3.5 w-3.5 text-red-500" />}
                                  {file.status === 'renamed' && <FileCode className="h-3.5 w-3.5 text-yellow-500" />}
                                  {!['added', 'modified', 'deleted', 'renamed'].includes(file.status) && (
                                    <FileCode className="h-3.5 w-3.5 text-muted-foreground" />
                                  )}
                                  <span className="text-xs font-mono truncate">{file.path.split('/').pop() || file.path}</span>
                                </div>
                                <div className="text-[10px] text-muted-foreground mt-0.5 truncate">{file.path}</div>
                              </button>
                            ))}
                          </div>
                        </ScrollArea>
                        <div className="h-64 bg-muted/10">
                          <div className="px-3 py-2 border-b border-border text-xs font-medium flex items-center justify-between">
                            <span className="truncate">{mergePreviewSelectedFile || 'Select a file'}</span>
                            {mergePreviewSelectedFile && (
                              <Badge variant="outline" className="text-[10px]">
                                {mergePreviewFiles.find((f) => f.path === mergePreviewSelectedFile)?.status || ''}
                              </Badge>
                            )}
                          </div>
                          <div className="p-2 h-[calc(100%-33px)] overflow-auto">
                            {mergePreviewLoading ? (
                              <div className="flex items-center gap-2 text-muted-foreground text-xs">
                                <Loader2 className="h-3 w-3 animate-spin" />
                                Loading diff...
                              </div>
                            ) : (
                              <div className="whitespace-pre-wrap">
                                {renderMergeDiff(mergePreviewDiff)}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {mergeResult && (
            <div className="py-4">
              <div className={`rounded-lg p-4 text-sm ${
                mergeResult.success
                  ? 'bg-success/10 border border-success/30'
                  : 'bg-destructive/10 border border-destructive/30'
              }`}>
                <div className="flex items-start gap-2">
                  {mergeResult.success ? (
                    <Check className="h-4 w-4 text-success mt-0.5" />
                  ) : (
                    <X className="h-4 w-4 text-destructive mt-0.5" />
                  )}
                  <div>
                    <p className={`font-medium ${mergeResult.success ? 'text-success' : 'text-destructive'}`}>
                      {mergeResult.success ? 'Merge Successful' : 'Merge Failed'}
                    </p>
                    <p className="text-muted-foreground mt-1">{mergeResult.message}</p>
                    {mergeResult.conflictFiles && mergeResult.conflictFiles.length > 0 && (
                      <div className="mt-2">
                        <p className="text-xs font-medium">Conflicting files:</p>
                        <ul className="list-disc list-inside text-xs mt-1">
                          {mergeResult.conflictFiles.map(file => (
                            <li key={file} className="font-mono">{file}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowMergeDialog(false);
                setMergeResult(null);
              }}
            >
              {mergeResult ? 'Close' : 'Cancel'}
            </Button>
            {!mergeResult && (
              <Button
                onClick={handleMerge}
                disabled={isMerging}
              >
                {isMerging ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Merging...
                  </>
                ) : (
                  <>
                    <GitMerge className="h-4 w-4 mr-2" />
                    Merge
                  </>
                )}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Worktree?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the worktree and all uncommitted changes.
              {worktreeToDelete && (
                <span className="block mt-2 font-mono text-sm">
                  {worktreeToDelete.branch}
                </span>
              )}
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Deleting...
                </>
              ) : (
                <>
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete
                </>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Terminal Worktree Delete Confirmation Dialog */}
      <AlertDialog open={!!terminalWorktreeToDelete} onOpenChange={(open) => !open && setTerminalWorktreeToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Terminal Worktree?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the worktree and its branch. Any uncommitted changes will be lost.
              {terminalWorktreeToDelete && (
                <span className="block mt-2 font-mono text-sm">
                  {terminalWorktreeToDelete.name}
                  {terminalWorktreeToDelete.branchName && (
                    <span className="text-muted-foreground"> ({terminalWorktreeToDelete.branchName})</span>
                  )}
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeletingTerminal}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteTerminalWorktree}
              disabled={isDeletingTerminal}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeletingTerminal ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Deleting...
                </>
              ) : (
                <>
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete
                </>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Bulk Delete Confirmation Dialog */}
      <AlertDialog open={showBulkDeleteConfirm} onOpenChange={setShowBulkDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-destructive" />
              {t('dialogs:worktrees.bulkDeleteTitle', { count: selectedWorktreeIds.size })}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t('dialogs:worktrees.bulkDeleteDescription')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isBulkDeleting}>{t('common:buttons.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                executeBulkDelete();
              }}
              disabled={isBulkDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isBulkDeleting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {t('dialogs:worktrees.deleting')}
                </>
              ) : (
                <>
                  <Trash2 className="mr-2 h-4 w-4" />
                  {t('dialogs:worktrees.deleteSelected')}
                </>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Create PR Dialog */}
      {prTask && prWorktree && (
        <CreatePRDialog
          open={showCreatePRDialog}
          task={prTask}
          worktreeStatus={worktreeToStatus(prWorktree)}
          onOpenChange={setShowCreatePRDialog}
          onCreatePR={handleCreatePR}
        />
      )}
    </div>
  );
}

/**
 * JIRA Integration Section for Task Detail
 * Creates a parent JIRA issue with sub-tasks for each subtask in the implementation plan
 */

import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ClipboardList,
  ExternalLink,
  Loader2,
  CheckCircle2,
  AlertCircle,
  ChevronDown,
  ChevronRight
} from 'lucide-react';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { useToast } from '../../hooks/use-toast';
import { useSettingsStore } from '../../stores/settings-store';
import type { Task } from '../../../shared/types';

interface TaskIssueState {
  parentIssueKey: string;
  parentIssueUrl: string;
  createdAt: string;
  projectKey: string;
  subtaskMapping: Record<string, string>;
  totalSubtasks: number;
}

interface JiraIntegrationSectionProps {
  task: Task;
}

export function JiraIntegrationSection({ task }: JiraIntegrationSectionProps) {
  const { t } = useTranslation(['tasks', 'settings']);
  const { toast } = useToast();
  const settings = useSettingsStore((state) => state.settings);

  const [jiraState, setJiraState] = useState<TaskIssueState | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showSubtasks, setShowSubtasks] = useState(false);

  // Check if JIRA is configured
  const isJiraConfigured = !!(settings?.globalJiraHost && settings?.globalJiraEmail && settings?.globalJiraToken);
  const jiraHost = settings?.globalJiraHost || '';

  // Load JIRA task issue state
  const loadJiraStatus = useCallback(async () => {
    if (!task.specsPath || !isJiraConfigured) return;

    setIsLoading(true);
    setError(null);

    try {
      const result = await window.electronAPI.getTaskIssue(task.specsPath);
      if (result.success) {
        setJiraState(result.data ?? null);
      } else {
        setError(result.error || 'Failed to load JIRA status');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsLoading(false);
    }
  }, [task.specsPath, isJiraConfigured]);

  // Load status on mount and when task changes
  useEffect(() => {
    loadJiraStatus();
  }, [loadJiraStatus]);

  // Handle creating JIRA issue (parent + sub-tasks)
  const handleCreateIssue = async () => {
    if (!task.specsPath) return;

    setIsCreating(true);
    setError(null);

    try {
      const result = await window.electronAPI.createTaskIssue(
        task.specsPath,
        task.title,
        task.description || task.title
      );

      if (result.success && result.data) {
        const { parentIssueKey, totalSubtasks } = result.data;
        toast({
          title: 'JIRA Issue Created',
          description: `Created ${parentIssueKey} with ${totalSubtasks} sub-task${totalSubtasks !== 1 ? 's' : ''}`,
          duration: 5000,
        });
        setJiraState(result.data);
      } else {
        setError(result.error || 'Failed to create JIRA issue');
        toast({
          title: 'Failed to Create Issue',
          description: result.error || 'Unknown error occurred',
          variant: 'destructive',
          duration: 5000,
        });
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMsg);
      toast({
        title: 'Failed to Create Issue',
        description: errorMsg,
        variant: 'destructive',
        duration: 5000,
      });
    } finally {
      setIsCreating(false);
    }
  };

  // Don't show section if JIRA is not configured
  if (!isJiraConfigured) {
    return null;
  }

  // Don't show if task has no specsPath (not started)
  if (!task.specsPath) {
    return null;
  }

  const hasIssue = !!jiraState?.parentIssueKey;
  const subtaskCount = jiraState?.totalSubtasks || 0;
  const subtaskMapping = jiraState?.subtaskMapping || {};

  return (
    <div className="rounded-lg border border-info/30 bg-info/5 p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ClipboardList className="h-5 w-5 text-info" />
          <span className="font-medium">JIRA</span>
          {hasIssue && (
            <Badge variant="success" className="text-xs flex items-center gap-1">
              <CheckCircle2 className="h-3 w-3" />
              {jiraState.parentIssueKey}
            </Badge>
          )}
        </div>

        <div className="flex items-center gap-2">
          {isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          ) : hasIssue ? (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() => window.electronAPI.openExternal(jiraState.parentIssueUrl)}
              >
                <ExternalLink className="mr-1.5 h-3.5 w-3.5" />
                Open in JIRA
              </Button>
              {subtaskCount < (task.subtasks?.length || 0) && (
                <Button
                  variant="default"
                  size="sm"
                  onClick={handleCreateIssue}
                  disabled={isCreating}
                >
                  {isCreating ? (
                    <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <ClipboardList className="mr-1.5 h-3.5 w-3.5" />
                  )}
                  Sync Sub-tasks
                </Button>
              )}
            </>
          ) : (
            <Button
              variant="default"
              size="sm"
              onClick={handleCreateIssue}
              disabled={isCreating}
            >
              {isCreating ? (
                <>
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <ClipboardList className="mr-1.5 h-3.5 w-3.5" />
                  Create JIRA Issue
                </>
              )}
            </Button>
          )}
        </div>
      </div>

      {/* Error display */}
      {error && (
        <div className="mt-3 flex items-center gap-2 text-sm text-destructive">
          <AlertCircle className="h-4 w-4" />
          {error}
        </div>
      )}

      {/* Sub-task summary */}
      {hasIssue && subtaskCount > 0 && (
        <div className="mt-3 pt-3 border-t border-info/20">
          <button
            type="button"
            onClick={() => setShowSubtasks(!showSubtasks)}
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors bg-transparent border-none cursor-pointer p-0"
          >
            {showSubtasks ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
            {subtaskCount} sub-task{subtaskCount !== 1 ? 's' : ''} created
          </button>

          {showSubtasks && (
            <div className="mt-2 pl-5 space-y-1 max-h-40 overflow-y-auto">
              {Object.entries(subtaskMapping).map(([subtaskId, issueKey]) => (
                <div key={subtaskId} className="flex items-center gap-2 text-xs">
                  <span className="font-mono text-muted-foreground truncate max-w-[120px]" title={subtaskId}>
                    {subtaskId}
                  </span>
                  <span className="text-border">→</span>
                  <button
                    type="button"
                    onClick={() => window.electronAPI.openExternal(`${jiraHost.replace(/\/$/, '')}/browse/${issueKey}`)}
                    className="font-mono text-info hover:underline bg-transparent border-none cursor-pointer p-0"
                  >
                    {issueKey}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

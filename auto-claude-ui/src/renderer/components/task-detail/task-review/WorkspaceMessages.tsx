import { AlertCircle, GitMerge, Loader2 } from 'lucide-react';
import type { Task } from '../../../../shared/types';

interface LoadingMessageProps {
  message?: string;
}

/**
 * Displays a loading indicator while workspace info is being fetched
 */
export function LoadingMessage({ message = 'Loading workspace info...' }: LoadingMessageProps) {
  return (
    <div className="rounded-xl border border-border bg-secondary/30 p-4">
      <div className="flex items-center gap-2 text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span className="text-sm">{message}</span>
      </div>
    </div>
  );
}

/**
 * Displays message when no workspace is found for the task
 */
export function NoWorkspaceMessage() {
  return (
    <div className="rounded-xl border border-border bg-secondary/30 p-4">
      <h3 className="font-medium text-sm text-foreground mb-2 flex items-center gap-2">
        <AlertCircle className="h-4 w-4 text-muted-foreground" />
        No Workspace Found
      </h3>
      <p className="text-sm text-muted-foreground">
        No isolated workspace was found for this task. The changes may have been made directly in your project.
      </p>
    </div>
  );
}

interface StagedInProjectMessageProps {
  task: Task;
}

/**
 * Displays message when changes have already been staged in the main project
 */
export function StagedInProjectMessage({ task }: StagedInProjectMessageProps) {
  return (
    <div className="rounded-xl border border-success/30 bg-success/10 p-4">
      <h3 className="font-medium text-sm text-foreground mb-2 flex items-center gap-2">
        <GitMerge className="h-4 w-4 text-success" />
        Changes Staged in Project
      </h3>
      <p className="text-sm text-muted-foreground mb-3">
        This task's changes have been staged in your main project{task.stagedAt ? ` on ${new Date(task.stagedAt).toLocaleDateString()}` : ''}.
      </p>
      <div className="bg-background/50 rounded-lg p-3">
        <p className="text-xs text-muted-foreground mb-2">Next steps:</p>
        <ol className="text-xs text-muted-foreground space-y-1 list-decimal list-inside">
          <li>Review staged changes with <code className="bg-background px-1 rounded">git status</code> and <code className="bg-background px-1 rounded">git diff --staged</code></li>
          <li>Commit when ready: <code className="bg-background px-1 rounded">git commit -m "your message"</code></li>
          <li>Push to remote when satisfied</li>
        </ol>
      </div>
    </div>
  );
}

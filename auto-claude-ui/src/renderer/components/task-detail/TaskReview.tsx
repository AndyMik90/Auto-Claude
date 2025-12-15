import {
  GitBranch,
  FileCode,
  Plus,
  Minus,
  Eye,
  ExternalLink,
  GitMerge,
  FolderX,
  Loader2,
  AlertCircle,
  RotateCcw
} from 'lucide-react';
import { Button } from '../ui/button';
import { Textarea } from '../ui/textarea';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../ui/alert-dialog';
import { Badge } from '../ui/badge';
import { cn } from '../../lib/utils';
import type { Task, WorktreeStatus, WorktreeDiff } from '../../../shared/types';

interface TaskReviewProps {
  task: Task;
  feedback: string;
  isSubmitting: boolean;
  worktreeStatus: WorktreeStatus | null;
  worktreeDiff: WorktreeDiff | null;
  isLoadingWorktree: boolean;
  isMerging: boolean;
  isDiscarding: boolean;
  showDiscardDialog: boolean;
  showDiffDialog: boolean;
  workspaceError: string | null;
  stageOnly: boolean;
  onFeedbackChange: (value: string) => void;
  onReject: () => void;
  onMerge: () => void;
  onDiscard: () => void;
  onShowDiscardDialog: (show: boolean) => void;
  onShowDiffDialog: (show: boolean) => void;
  onStageOnlyChange: (value: boolean) => void;
}

export function TaskReview({
  task,
  feedback,
  isSubmitting,
  worktreeStatus,
  worktreeDiff,
  isLoadingWorktree,
  isMerging,
  isDiscarding,
  showDiscardDialog,
  showDiffDialog,
  workspaceError,
  stageOnly,
  onFeedbackChange,
  onReject,
  onMerge,
  onDiscard,
  onShowDiscardDialog,
  onShowDiffDialog,
  onStageOnlyChange
}: TaskReviewProps) {
  return (
    <div className="space-y-4">
      {/* Section divider */}
      <div className="section-divider-gradient" />

      {/* Workspace Status */}
      {isLoadingWorktree ? (
        <div className="rounded-xl border border-border bg-secondary/30 p-4">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span className="text-sm">Loading workspace info...</span>
          </div>
        </div>
      ) : worktreeStatus?.exists ? (
        <div className="review-section-highlight">
          <h3 className="font-medium text-sm text-foreground mb-3 flex items-center gap-2">
            <GitBranch className="h-4 w-4 text-purple-400" />
            Build Ready for Review
          </h3>

          {/* Change Summary */}
          <div className="bg-background/50 rounded-lg p-3 mb-3">
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div className="flex items-center gap-2">
                <FileCode className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">Files changed:</span>
                <span className="text-foreground font-medium">{worktreeStatus.filesChanged || 0}</span>
              </div>
              <div className="flex items-center gap-2">
                <GitBranch className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">Commits:</span>
                <span className="text-foreground font-medium">{worktreeStatus.commitCount || 0}</span>
              </div>
              <div className="flex items-center gap-2">
                <Plus className="h-4 w-4 text-success" />
                <span className="text-muted-foreground">Additions:</span>
                <span className="text-success font-medium">+{worktreeStatus.additions || 0}</span>
              </div>
              <div className="flex items-center gap-2">
                <Minus className="h-4 w-4 text-destructive" />
                <span className="text-muted-foreground">Deletions:</span>
                <span className="text-destructive font-medium">-{worktreeStatus.deletions || 0}</span>
              </div>
            </div>
            {worktreeStatus.branch && (
              <div className="mt-2 pt-2 border-t border-border/50 text-xs text-muted-foreground">
                Branch: <code className="bg-background px-1 rounded">{worktreeStatus.branch}</code>
                {' → '}
                <code className="bg-background px-1 rounded">{worktreeStatus.baseBranch || 'main'}</code>
              </div>
            )}
          </div>

          {/* Workspace Error */}
          {workspaceError && (
            <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-3 mb-3">
              <p className="text-sm text-destructive">{workspaceError}</p>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-2 mb-3">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onShowDiffDialog(true)}
              className="flex-1"
            >
              <Eye className="mr-2 h-4 w-4" />
              View Changes
            </Button>
            {worktreeStatus.worktreePath && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  window.electronAPI.createTerminal({
                    id: `open-${task.id}`,
                    cwd: worktreeStatus.worktreePath!
                  });
                }}
                className="flex-none"
              >
                <ExternalLink className="h-4 w-4" />
              </Button>
            )}
          </div>

          {/* Stage Only Option */}
          <label className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer select-none">
            <input
              type="checkbox"
              checked={stageOnly}
              onChange={(e) => onStageOnlyChange(e.target.checked)}
              className="rounded border-border"
            />
            <span>Stage only (review in IDE before committing)</span>
          </label>

          {/* Primary Actions */}
          <div className="flex gap-2">
            <Button
              variant="success"
              onClick={onMerge}
              disabled={isMerging || isDiscarding}
              className="flex-1"
            >
              {isMerging ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {stageOnly ? 'Staging...' : 'Merging...'}
                </>
              ) : (
                <>
                  <GitMerge className="mr-2 h-4 w-4" />
                  {stageOnly ? 'Stage Changes' : 'Merge to Main'}
                </>
              )}
            </Button>
            <Button
              variant="outline"
              onClick={() => onShowDiscardDialog(true)}
              disabled={isMerging || isDiscarding}
              className="text-destructive hover:text-destructive hover:bg-destructive/10"
            >
              <FolderX className="h-4 w-4" />
            </Button>
          </div>
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-secondary/30 p-4">
          <h3 className="font-medium text-sm text-foreground mb-2 flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-muted-foreground" />
            No Workspace Found
          </h3>
          <p className="text-sm text-muted-foreground">
            No isolated workspace was found for this task. The changes may have been made directly in your project.
          </p>
        </div>
      )}

      {/* QA Feedback Section */}
      <div className="rounded-xl border border-warning/30 bg-warning/10 p-4">
        <h3 className="font-medium text-sm text-foreground mb-2 flex items-center gap-2">
          <AlertCircle className="h-4 w-4 text-warning" />
          Request Changes
        </h3>
        <p className="text-sm text-muted-foreground mb-3">
          Found issues? Describe what needs to be fixed and the AI will continue working on it.
        </p>
        <Textarea
          placeholder="Describe the issues or changes needed..."
          value={feedback}
          onChange={(e) => onFeedbackChange(e.target.value)}
          className="mb-3"
          rows={3}
        />
        <Button
          variant="warning"
          onClick={onReject}
          disabled={isSubmitting || !feedback.trim()}
          className="w-full"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Submitting...
            </>
          ) : (
            <>
              <RotateCcw className="mr-2 h-4 w-4" />
              Request Changes
            </>
          )}
        </Button>
      </div>

      {/* Discard Confirmation Dialog */}
      <AlertDialog open={showDiscardDialog} onOpenChange={onShowDiscardDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <FolderX className="h-5 w-5 text-destructive" />
              Discard Build
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="text-sm text-muted-foreground space-y-3">
                <p>
                  Are you sure you want to discard all changes for <strong className="text-foreground">"{task.title}"</strong>?
                </p>
                <p className="text-destructive">
                  This will permanently delete the isolated workspace and all uncommitted changes.
                  The task will be moved back to Planning status.
                </p>
                {worktreeStatus?.exists && (
                  <div className="bg-muted/50 rounded-lg p-3 text-sm">
                    <div className="flex justify-between mb-1">
                      <span className="text-muted-foreground">Files changed:</span>
                      <span>{worktreeStatus.filesChanged || 0}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Lines:</span>
                      <span className="text-success">+{worktreeStatus.additions || 0}</span>
                      <span className="text-destructive">-{worktreeStatus.deletions || 0}</span>
                    </div>
                  </div>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDiscarding}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                onDiscard();
              }}
              disabled={isDiscarding}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDiscarding ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Discarding...
                </>
              ) : (
                <>
                  <FolderX className="mr-2 h-4 w-4" />
                  Discard Build
                </>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Diff View Dialog */}
      <AlertDialog open={showDiffDialog} onOpenChange={onShowDiffDialog}>
        <AlertDialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Eye className="h-5 w-5 text-purple-400" />
              Changed Files
            </AlertDialogTitle>
            <AlertDialogDescription>
              {worktreeDiff?.summary || 'No changes found'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="flex-1 overflow-auto min-h-0 -mx-6 px-6">
            {worktreeDiff?.files && worktreeDiff.files.length > 0 ? (
              <div className="space-y-2">
                {worktreeDiff.files.map((file, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between p-2 rounded-lg bg-secondary/30 hover:bg-secondary/50 transition-colors"
                  >
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <FileCode className={cn(
                        'h-4 w-4 shrink-0',
                        file.status === 'added' && 'text-success',
                        file.status === 'deleted' && 'text-destructive',
                        file.status === 'modified' && 'text-info',
                        file.status === 'renamed' && 'text-warning'
                      )} />
                      <span className="text-sm font-mono truncate">{file.path}</span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0 ml-2">
                      <Badge
                        variant="secondary"
                        className={cn(
                          'text-xs',
                          file.status === 'added' && 'bg-success/10 text-success',
                          file.status === 'deleted' && 'bg-destructive/10 text-destructive',
                          file.status === 'modified' && 'bg-info/10 text-info',
                          file.status === 'renamed' && 'bg-warning/10 text-warning'
                        )}
                      >
                        {file.status}
                      </Badge>
                      <span className="text-xs text-success">+{file.additions}</span>
                      <span className="text-xs text-destructive">-{file.deletions}</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                No changed files found
              </div>
            )}
          </div>
          <AlertDialogFooter className="mt-4">
            <AlertDialogCancel>Close</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

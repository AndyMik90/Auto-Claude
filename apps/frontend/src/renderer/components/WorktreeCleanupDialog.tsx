import { CheckCircle2, FolderX, Loader2 } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from './ui/alert-dialog';

interface WorktreeCleanupDialogProps {
  open: boolean;
  taskTitle: string;
  worktreePath?: string;
  isProcessing: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
}

/**
 * Confirmation dialog for cleaning up worktree when marking task as done
 */
export function WorktreeCleanupDialog({
  open,
  taskTitle,
  worktreePath,
  isProcessing,
  onOpenChange,
  onConfirm
}: WorktreeCleanupDialogProps) {
  console.log('[WorktreeCleanupDialog] Rendering with open:', open, 'taskTitle:', taskTitle);
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-success" />
            Complete Task
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="text-sm text-muted-foreground space-y-3">
              <p>
                The task <strong className="text-foreground">"{taskTitle}"</strong> still has an isolated workspace (worktree).
              </p>
              <p>
                To mark this task as complete, the worktree and its associated branch will be deleted.
              </p>
              {worktreePath && (
                <div className="bg-muted/50 rounded-lg p-3 text-sm font-mono text-xs break-all">
                  {worktreePath}
                </div>
              )}
              <p className="text-amber-600 dark:text-amber-500">
                Make sure you have merged or saved any changes you want to keep before proceeding.
              </p>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isProcessing}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault();
              onConfirm();
            }}
            disabled={isProcessing}
            className="bg-success text-success-foreground hover:bg-success/90"
          >
            {isProcessing ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Completing...
              </>
            ) : (
              <>
                <FolderX className="mr-2 h-4 w-4" />
                Delete Worktree & Complete
              </>
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

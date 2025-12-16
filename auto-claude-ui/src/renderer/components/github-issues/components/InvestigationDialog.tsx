import { Sparkles, Loader2, CheckCircle2 } from 'lucide-react';
import { Button } from '../../ui/button';
import { Progress } from '../../ui/progress';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '../../ui/dialog';
import type { InvestigationDialogProps } from '../types';

export function InvestigationDialog({
  open,
  onOpenChange,
  selectedIssue,
  investigationStatus,
  onStartInvestigation,
  onClose
}: InvestigationDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-info" />
            AI Investigation
          </DialogTitle>
          <DialogDescription>
            {selectedIssue && (
              <span>
                Investigating issue #{selectedIssue.number}: {selectedIssue.title}
              </span>
            )}
          </DialogDescription>
        </DialogHeader>

        {investigationStatus.phase === 'idle' ? (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              The AI will analyze this issue, examine relevant code, and create a planned task in your Kanban board.
            </p>
            <div className="rounded-lg border border-border bg-muted/30 p-4">
              <h4 className="text-sm font-medium mb-2">What the AI will do:</h4>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>- Analyze the issue description and comments</li>
                <li>- Identify affected files and components</li>
                <li>- Estimate complexity and effort</li>
                <li>- Create acceptance criteria</li>
                <li>- Generate a task spec for implementation</li>
              </ul>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">{investigationStatus.message}</span>
                <span className="text-foreground">{investigationStatus.progress}%</span>
              </div>
              <Progress value={investigationStatus.progress} className="h-2" />
            </div>

            {investigationStatus.phase === 'error' && (
              <div className="rounded-lg bg-destructive/10 border border-destructive/30 p-3 text-sm text-destructive">
                {investigationStatus.error}
              </div>
            )}

            {investigationStatus.phase === 'complete' && (
              <div className="rounded-lg bg-success/10 border border-success/30 p-3 flex items-center gap-2 text-sm text-success">
                <CheckCircle2 className="h-4 w-4" />
                Investigation complete! Task created in Kanban board.
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          {investigationStatus.phase === 'idle' && (
            <>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button onClick={onStartInvestigation}>
                <Sparkles className="h-4 w-4 mr-2" />
                Start Investigation
              </Button>
            </>
          )}
          {investigationStatus.phase !== 'idle' && investigationStatus.phase !== 'complete' && (
            <Button variant="outline" disabled>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Investigating...
            </Button>
          )}
          {investigationStatus.phase === 'complete' && (
            <Button onClick={onClose}>
              Done
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

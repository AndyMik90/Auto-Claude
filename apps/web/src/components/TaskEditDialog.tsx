/**
 * TaskEditDialog - Dialog for editing task details (simplified for web)
 *
 * Simplified version for web app focusing on core functionality:
 * - Edit task title and description
 * - Form validation
 * - Save via IPC abstraction
 */
import { useState, useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from './ui/dialog';
import { ipc } from '../lib/ipc-abstraction';
import type { Task } from '../types';

interface TaskEditDialogProps {
  task: Task;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved?: () => void;
}

export function TaskEditDialog({ task, open, onOpenChange, onSaved }: TaskEditDialogProps) {
  const [title, setTitle] = useState(task.title);
  const [description, setDescription] = useState(task.description);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset form when task changes or dialog opens
  useEffect(() => {
    if (open) {
      setTitle(task.title);
      setDescription(task.description);
      setError(null);
    }
  }, [open, task]);

  const handleSave = async () => {
    // Validate input
    if (!description.trim()) {
      setError('Description is required');
      return;
    }

    // Check if anything changed
    const trimmedTitle = title.trim();
    const trimmedDescription = description.trim();
    const hasChanges =
      trimmedTitle !== task.title ||
      trimmedDescription !== task.description;

    if (!hasChanges) {
      onOpenChange(false);
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      // Send update request via IPC
      ipc.send('task:update', {
        taskId: task.id,
        updates: {
          title: trimmedTitle,
          description: trimmedDescription
        }
      });

      // Wait for confirmation
      const handleResponse = (response: any) => {
        if (response.success) {
          onOpenChange(false);
          onSaved?.();
        } else {
          setError(response.error || 'Failed to update task');
        }
        setIsSaving(false);
        ipc.off('task:updated', handleResponse);
      };

      ipc.on('task:updated', handleResponse);

      // Timeout after 10 seconds
      setTimeout(() => {
        if (isSaving) {
          setError('Update timed out');
          setIsSaving(false);
          ipc.off('task:updated', handleResponse);
        }
      }, 10000);
    } catch (err) {
      setError('Failed to update task');
      setIsSaving(false);
    }
  };

  const isValid = description.trim().length > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Edit Task</DialogTitle>
          <DialogDescription>
            Make changes to your task. Click save when you're done.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Error message */}
          {error && (
            <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </div>
          )}

          {/* Title field (optional) */}
          <div className="space-y-2">
            <Label htmlFor="edit-title">
              Title <span className="text-xs text-muted-foreground">(optional)</span>
            </Label>
            <Input
              id="edit-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Optional short title..."
              disabled={isSaving}
              maxLength={200}
            />
          </div>

          {/* Description field (required) */}
          <div className="space-y-2">
            <Label htmlFor="edit-description">
              Description <span className="text-destructive">*</span>
            </Label>
            <Textarea
              id="edit-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe what needs to be done..."
              disabled={isSaving}
              className="min-h-[200px]"
              required
            />
            <p className="text-xs text-muted-foreground">
              Provide clear instructions for what needs to be accomplished
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isSaving || !isValid}>
            {isSaving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              'Save Changes'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

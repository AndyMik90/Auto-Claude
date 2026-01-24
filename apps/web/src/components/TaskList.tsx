/**
 * TaskList - Simple task creation dialog (simplified for web)
 *
 * Provides a simple interface for creating new tasks without the full
 * complexity of the desktop app's TaskCreationWizard.
 *
 * Features:
 * - Create new tasks with title and description
 * - Basic form validation
 * - Save via IPC abstraction
 */
import { useState } from 'react';
import { Loader2, Plus } from 'lucide-react';
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
  DialogTitle,
  DialogTrigger
} from './ui/dialog';
import { ipc } from '../lib/ipc-abstraction';

interface TaskCreateDialogProps {
  projectId: string;
  onCreated?: () => void;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function TaskCreateDialog({ projectId, onCreated, open: controlledOpen, onOpenChange }: TaskCreateDialogProps) {
  const [internalOpen, setInternalOpen] = useState(false);

  // Use controlled open state if provided, otherwise use internal state
  const open = controlledOpen !== undefined ? controlledOpen : internalOpen;
  const setOpen = (newOpen: boolean) => {
    if (onOpenChange) {
      onOpenChange(newOpen);
    } else {
      setInternalOpen(newOpen);
    }
  };
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleReset = () => {
    setTitle('');
    setDescription('');
    setError(null);
  };

  const handleCreate = async () => {
    // Validate input
    if (!description.trim()) {
      setError('Description is required');
      return;
    }

    setIsCreating(true);
    setError(null);

    try {
      // Send create request via IPC
      ipc.send('task:create', {
        projectId,
        title: title.trim(),
        description: description.trim()
      });

      // Wait for confirmation
      const handleResponse = (response: any) => {
        if (response.success) {
          handleReset();
          setOpen(false);
          onCreated?.();
        } else {
          setError(response.error || 'Failed to create task');
        }
        setIsCreating(false);
        ipc.off('task:created', handleResponse);
      };

      ipc.on('task:created', handleResponse);

      // Timeout after 10 seconds
      setTimeout(() => {
        if (isCreating) {
          setError('Create timed out');
          setIsCreating(false);
          ipc.off('task:created', handleResponse);
        }
      }, 10000);
    } catch (err) {
      setError('Failed to create task');
      setIsCreating(false);
    }
  };

  const isValid = description.trim().length > 0;

  return (
    <Dialog open={open} onOpenChange={(newOpen) => {
      setOpen(newOpen);
      if (!newOpen) {
        handleReset();
      }
    }}>
      <DialogTrigger asChild>
        <Button size="sm" className="gap-2">
          <Plus className="h-4 w-4" />
          New Task
        </Button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Create New Task</DialogTitle>
          <DialogDescription>
            Describe what you want to accomplish. The AI will help plan and execute it.
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
            <Label htmlFor="create-title">
              Title <span className="text-xs text-muted-foreground">(optional)</span>
            </Label>
            <Input
              id="create-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Optional short title..."
              disabled={isCreating}
              maxLength={200}
            />
          </div>

          {/* Description field (required) */}
          <div className="space-y-2">
            <Label htmlFor="create-description">
              Description <span className="text-destructive">*</span>
            </Label>
            <Textarea
              id="create-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe what needs to be done..."
              disabled={isCreating}
              className="min-h-[200px]"
              required
              autoFocus
            />
            <p className="text-xs text-muted-foreground">
              Provide clear instructions for what you want to accomplish
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => setOpen(false)}
            disabled={isCreating}
          >
            Cancel
          </Button>
          <Button onClick={handleCreate} disabled={isCreating || !isValid}>
            {isCreating ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Creating...
              </>
            ) : (
              'Create Task'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Simple wrapper component to use with KanbanBoard
export function TaskList() {
  return (
    <div className="flex items-center gap-2 p-4">
      <TaskCreateDialog projectId="default" />
    </div>
  );
}

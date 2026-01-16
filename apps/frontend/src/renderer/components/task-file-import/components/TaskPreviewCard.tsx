/**
 * TaskPreviewCard - Preview card for a single parsed task
 *
 * Shows:
 * - Checkbox for selection
 * - Title and truncated description
 * - Category/priority badges
 * - Validation error indicator
 */

import { useTranslation } from 'react-i18next';
import { AlertCircle, FileJson } from 'lucide-react';
import { Checkbox } from '../../ui/checkbox';
import { Badge } from '../../ui/badge';
import { cn } from '../../../lib/utils';
import type { ParsedTask } from '../types';

interface TaskPreviewCardProps {
  task: ParsedTask;
  isSelected: boolean;
  onToggle: () => void;
  disabled?: boolean;
}

/**
 * Truncate text to a maximum length
 */
function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength).trim() + '...';
}

/**
 * Get workflow type badge variant
 */
function getWorkflowTypeBadgeVariant(type?: string): 'default' | 'secondary' | 'outline' | 'destructive' {
  switch (type) {
    case 'feature':
      return 'default';
    case 'refactor':
      return 'secondary';
    case 'investigation':
      return 'destructive';
    default:
      return 'outline';
  }
}

export function TaskPreviewCard({
  task,
  isSelected,
  onToggle,
  disabled = false
}: TaskPreviewCardProps) {
  const { t } = useTranslation(['tasks', 'common']);

  const isDisabled = disabled || !task.isValid;

  // Extract first line of description for preview
  const descriptionPreview = task.description
    .split('\n')
    .find(line => line.trim() && !line.startsWith('#'))
    ?.trim() || '';

  return (
    <div
      className={cn(
        'flex items-start gap-3 p-3 rounded-lg border transition-colors',
        isSelected && task.isValid
          ? 'border-primary bg-primary/5'
          : 'border-border bg-card',
        !task.isValid && 'border-destructive/50 bg-destructive/5',
        isDisabled ? 'opacity-60' : 'hover:bg-muted/30 cursor-pointer'
      )}
      onClick={() => !isDisabled && onToggle()}
      role="button"
      tabIndex={isDisabled ? -1 : 0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          if (!isDisabled) onToggle();
        }
      }}
    >
      {/* Checkbox */}
      <div className="pt-0.5">
        <Checkbox
          checked={isSelected}
          onCheckedChange={() => onToggle()}
          disabled={isDisabled}
          aria-label={`Select task: ${task.title}`}
          onClick={(e) => e.stopPropagation()}
        />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0 space-y-1.5">
        {/* Header with title and badges */}
        <div className="flex items-start gap-2 flex-wrap">
          <h4 className="font-medium text-foreground truncate flex-1 min-w-0">
            {task.title || t('common:labels.untitled')}
          </h4>

          {/* Workflow type badge */}
          {task.workflow_type && (
            <Badge variant={getWorkflowTypeBadgeVariant(task.workflow_type)} className="text-xs">
              {task.workflow_type}
            </Badge>
          )}

          {/* Priority badge */}
          {task.priority && task.priority !== 'medium' && (
            <Badge
              variant={task.priority === 'high' || task.priority === 'critical' ? 'destructive' : 'outline'}
              className="text-xs"
            >
              {task.priority}
            </Badge>
          )}
        </div>

        {/* Description preview */}
        {descriptionPreview && (
          <p className="text-sm text-muted-foreground line-clamp-2">
            {truncate(descriptionPreview, 150)}
          </p>
        )}

        {/* Source file */}
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <FileJson className="h-3 w-3" />
          <span>{task.sourceFile}</span>
        </div>

        {/* Validation errors */}
        {!task.isValid && task.validationErrors.length > 0 && (
          <div className="flex items-start gap-1.5 text-xs text-destructive mt-2">
            <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
            <span>{task.validationErrors.join(', ')}</span>
          </div>
        )}
      </div>
    </div>
  );
}

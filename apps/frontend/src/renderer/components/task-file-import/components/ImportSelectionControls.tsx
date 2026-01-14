/**
 * ImportSelectionControls - Select all / deselect controls and stats
 */

import { useTranslation } from 'react-i18next';
import { Button } from '../../ui/button';
import type { ParsedTask } from '../types';

interface ImportSelectionControlsProps {
  tasks: ParsedTask[];
  selectedCount: number;
  onSelectAll: () => void;
  onDeselectAll: () => void;
  disabled?: boolean;
}

export function ImportSelectionControls({
  tasks,
  selectedCount,
  onSelectAll,
  onDeselectAll,
  disabled = false
}: ImportSelectionControlsProps) {
  const { t } = useTranslation(['tasks']);

  const validCount = tasks.filter(t => t.isValid).length;
  const invalidCount = tasks.length - validCount;

  return (
    <div className="flex items-center justify-between py-2 border-b border-border">
      {/* Selection buttons */}
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={onSelectAll}
          disabled={disabled || validCount === 0}
          className="h-7 text-xs"
        >
          {t('taskFileImport.selectAll')}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={onDeselectAll}
          disabled={disabled || selectedCount === 0}
          className="h-7 text-xs"
        >
          {t('taskFileImport.deselectAll')}
        </Button>
      </div>

      {/* Stats */}
      <div className="flex items-center gap-3 text-xs text-muted-foreground">
        <span>
          {t('taskFileImport.selectedCount', {
            count: selectedCount,
            total: validCount
          })}
        </span>
        {invalidCount > 0 && (
          <span className="text-destructive">
            ({invalidCount} invalid)
          </span>
        )}
      </div>
    </div>
  );
}

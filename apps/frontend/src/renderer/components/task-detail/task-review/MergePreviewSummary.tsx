import { CheckCircle, AlertTriangle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '../../ui/button';
import { cn } from '../../../lib/utils';
import type { MergeConflict, MergeStats, GitConflictInfo } from '../../../../shared/types';

interface MergePreviewSummaryProps {
  mergePreview: {
    files: string[];
    conflicts: MergeConflict[];
    summary: MergeStats;
    gitConflicts?: GitConflictInfo;
  };
  onShowConflictDialog: (show: boolean) => void;
}

/**
 * Displays a summary of the merge preview including conflicts and statistics
 */
export function MergePreviewSummary({
  mergePreview,
  onShowConflictDialog
}: MergePreviewSummaryProps) {
  const { t } = useTranslation(['taskReview', 'common']);
  const hasGitConflicts = mergePreview.gitConflicts?.hasConflicts;
  const hasAIConflicts = mergePreview.conflicts.length > 0;
  const hasHighSeverity = mergePreview.conflicts.some(
    c => c.severity === 'high' || c.severity === 'critical'
  );

  return (
    <div className={cn(
      "rounded-lg p-3 mb-3 border",
      hasGitConflicts
        ? "bg-warning/10 border-warning/30"
        : !hasAIConflicts
          ? "bg-success/10 border-success/30"
          : hasHighSeverity
            ? "bg-destructive/10 border-destructive/30"
            : "bg-warning/10 border-warning/30"
    )}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium flex items-center gap-2">
          {hasGitConflicts ? (
            <>
              <AlertTriangle className="h-4 w-4 text-warning" />
              {t('taskReview:mergePreview.branchDiverged')}
            </>
          ) : !hasAIConflicts ? (
            <>
              <CheckCircle className="h-4 w-4 text-success" />
              {t('taskReview:mergePreview.noConflictsDetected')}
            </>
          ) : (
            <>
              <AlertTriangle className="h-4 w-4 text-warning" />
              {t('taskReview:mergePreview.conflictsFound', { count: mergePreview.conflicts.length })}
            </>
          )}
        </span>
        {hasAIConflicts && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onShowConflictDialog(true)}
            className="h-7 text-xs"
          >
            {t('taskReview:mergePreview.viewDetails')}
          </Button>
        )}
      </div>

      {hasGitConflicts && mergePreview.gitConflicts && (
        <div className="mb-3 p-2 bg-warning/10 rounded text-xs border border-warning/30">
          <p className="font-medium text-warning mb-1">{t('taskReview:mergePreview.branchDivergedDetail')}</p>
          <p className="text-muted-foreground mb-2">
            {t('taskReview:mergePreview.commitsBehind', { count: mergePreview.gitConflicts.commitsBehind })}
            {t('taskReview:mergePreview.filesNeedMerge', { count: mergePreview.gitConflicts.conflictingFiles.length })}
          </p>
          <ul className="list-disc list-inside text-muted-foreground">
            {mergePreview.gitConflicts.conflictingFiles.map((file, idx) => (
              <li key={idx} className="truncate">{file}</li>
            ))}
          </ul>
          <p className="mt-2 text-muted-foreground">
            {t('taskReview:mergePreview.aiWillResolve')}
          </p>
        </div>
      )}

      <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
        <div>{t('taskReview:mergePreview.filesToMerge')} {mergePreview.summary.totalFiles}</div>
        {hasGitConflicts ? (
          <div className="text-warning">{t('taskReview:mergePreview.aiWillResolveConflicts')}</div>
        ) : hasAIConflicts ? (
          <>
            <div>{t('taskReview:mergePreview.autoMergeable')} {mergePreview.summary.autoMergeable}</div>
            {mergePreview.summary.aiResolved !== undefined && (
              <div>{t('taskReview:mergePreview.aiResolved')} {mergePreview.summary.aiResolved}</div>
            )}
            {mergePreview.summary.humanRequired !== undefined && mergePreview.summary.humanRequired > 0 && (
              <div className="text-warning">{t('taskReview:mergePreview.manualReview')} {mergePreview.summary.humanRequired}</div>
            )}
          </>
        ) : (
          <div className="text-success">{t('taskReview:mergePreview.readyToMerge')}</div>
        )}
      </div>
    </div>
  );
}

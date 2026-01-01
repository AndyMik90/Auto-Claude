import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollArea } from '../ui/scroll-area';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import {
  GitCommit,
  FileCode,
  Plus,
  Minus,
  ChevronDown,
  ChevronRight,
  Loader2,
  AlertCircle,
  RefreshCw,
  GitBranch
} from 'lucide-react';
import { cn } from '../../lib/utils';
import type { Task, TaskMergedChanges as TaskMergedChangesType, MergedCommit, MergedFileChange, DiffHunk, DiffLine } from '../../../shared/types';

interface TaskMergedChangesProps {
  task: Task;
}

export function TaskMergedChanges({ task }: TaskMergedChangesProps) {
  const { t } = useTranslation(['tasks', 'common']);
  const [mergedChanges, setMergedChanges] = useState<TaskMergedChangesType | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedCommits, setExpandedCommits] = useState<Set<string>>(new Set());
  const [expandedFiles, setExpandedFiles] = useState<Set<string>>(new Set());
  const [showFiles, setShowFiles] = useState(true);

  const loadMergedChanges = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await window.electronAPI.getTaskMergedChanges(task.id);
      if (result.success && result.data) {
        setMergedChanges(result.data);
        if (!result.data.found) {
          setError(result.data.message || t('tasks:mergedChanges.notFound'));
        }
      } else {
        setError(result.error || t('tasks:mergedChanges.loadError'));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t('tasks:mergedChanges.loadError'));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (task.status === 'done') {
      loadMergedChanges();
    }
  }, [task.id, task.status]);

  const toggleCommit = (hash: string) => {
    setExpandedCommits(prev => {
      const next = new Set(prev);
      if (next.has(hash)) {
        next.delete(hash);
      } else {
        next.add(hash);
      }
      return next;
    });
  };

  const toggleFile = (path: string) => {
    setExpandedFiles(prev => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  };

  const formatDate = (dateStr: string) => {
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return dateStr;
    }
  };

  const getFileStatusColor = (status: MergedFileChange['status']) => {
    switch (status) {
      case 'added': return 'text-success';
      case 'deleted': return 'text-destructive';
      case 'modified': return 'text-warning';
      case 'renamed': return 'text-info';
      default: return 'text-muted-foreground';
    }
  };

  const getFileStatusLabel = (status: MergedFileChange['status']) => {
    switch (status) {
      case 'added': return t('tasks:mergedChanges.fileStatus.added');
      case 'deleted': return t('tasks:mergedChanges.fileStatus.deleted');
      case 'modified': return t('tasks:mergedChanges.fileStatus.modified');
      case 'renamed': return t('tasks:mergedChanges.fileStatus.renamed');
      default: return status;
    }
  };

  const renderDiffLine = (line: DiffLine, index: number) => {
    const lineClasses = cn(
      'font-mono text-xs whitespace-pre leading-5 px-2',
      line.type === 'added' && 'bg-success/20 text-success-foreground',
      line.type === 'removed' && 'bg-destructive/20 text-destructive-foreground',
      line.type === 'context' && 'text-muted-foreground'
    );

    const lineNumberClasses = 'text-muted-foreground/50 select-none w-8 text-right pr-2 shrink-0';
    const prefixClasses = cn(
      'select-none w-4 text-center shrink-0',
      line.type === 'added' && 'text-success',
      line.type === 'removed' && 'text-destructive'
    );

    return (
      <div key={index} className={cn('flex', lineClasses)}>
        <span className={lineNumberClasses}>
          {line.oldLineNumber || ''}
        </span>
        <span className={lineNumberClasses}>
          {line.newLineNumber || ''}
        </span>
        <span className={prefixClasses}>
          {line.type === 'added' ? '+' : line.type === 'removed' ? '-' : ' '}
        </span>
        <span className="flex-1 overflow-x-auto">{line.content || ' '}</span>
      </div>
    );
  };

  const renderDiffHunk = (hunk: DiffHunk, hunkIndex: number) => {
    return (
      <div key={hunkIndex} className="border-t border-border/30 first:border-t-0">
        <div className="bg-muted/50 px-2 py-1 text-xs font-mono text-muted-foreground">
          @@ -{hunk.oldStart},{hunk.oldCount} +{hunk.newStart},{hunk.newCount} @@
        </div>
        <div className="divide-y divide-border/10">
          {hunk.lines.map((line, lineIndex) => renderDiffLine(line, lineIndex))}
        </div>
      </div>
    );
  };

  if (task.status !== 'done') {
    return null;
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin mr-2" />
        <span>{t('tasks:mergedChanges.loading')}</span>
      </div>
    );
  }

  if (error && !mergedChanges?.found) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-muted-foreground gap-3">
        <AlertCircle className="h-8 w-8 text-muted-foreground/50" />
        <p className="text-sm text-center max-w-md">{error}</p>
        <Button variant="outline" size="sm" onClick={loadMergedChanges}>
          <RefreshCw className="h-4 w-4 mr-2" />
          {t('common:retry')}
        </Button>
      </div>
    );
  }

  if (!mergedChanges?.found) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-muted-foreground gap-2">
        <GitBranch className="h-8 w-8 text-muted-foreground/50" />
        <p className="text-sm">{t('tasks:mergedChanges.notFound')}</p>
      </div>
    );
  }

  const { commits, files, totalAdditions, totalDeletions, taskBranch, baseBranch } = mergedChanges;

  return (
    <div className="space-y-4">
      {/* Header with stats */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <GitCommit className="h-4 w-4" />
            <span>{commits.length} {commits.length === 1 ? t('tasks:mergedChanges.commit') : t('tasks:mergedChanges.commits')}</span>
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <FileCode className="h-4 w-4" />
            <span>{files.length} {files.length === 1 ? t('tasks:mergedChanges.file') : t('tasks:mergedChanges.files')}</span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <span className="text-success flex items-center gap-1">
              <Plus className="h-3 w-3" />
              {totalAdditions}
            </span>
            <span className="text-destructive flex items-center gap-1">
              <Minus className="h-3 w-3" />
              {totalDeletions}
            </span>
          </div>
        </div>
        <Button variant="ghost" size="sm" onClick={loadMergedChanges}>
          <RefreshCw className="h-4 w-4" />
        </Button>
      </div>

      {/* Branch info */}
      {(taskBranch || baseBranch) && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <GitBranch className="h-3 w-3" />
          {taskBranch && <Badge variant="outline" className="text-xs font-mono">{taskBranch}</Badge>}
          {baseBranch && (
            <>
              <span>into</span>
              <Badge variant="secondary" className="text-xs font-mono">{baseBranch}</Badge>
            </>
          )}
        </div>
      )}

      {/* Commits section */}
      {commits.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-medium flex items-center gap-2">
            <GitCommit className="h-4 w-4" />
            {t('tasks:mergedChanges.commitsTitle')}
          </h4>
          <ScrollArea className="max-h-48">
            <div className="space-y-1">
              {commits.map((commit: MergedCommit) => (
                <div
                  key={commit.hash}
                  className="group rounded-md border border-border/50 bg-muted/30 hover:bg-muted/50 transition-colors"
                >
                  <button
                    onClick={() => toggleCommit(commit.hash)}
                    className="w-full text-left px-3 py-2 flex items-start gap-2"
                  >
                    {expandedCommits.has(commit.hash) ? (
                      <ChevronDown className="h-4 w-4 mt-0.5 shrink-0 text-muted-foreground" />
                    ) : (
                      <ChevronRight className="h-4 w-4 mt-0.5 shrink-0 text-muted-foreground" />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <code className="text-xs font-mono text-primary">{commit.shortHash}</code>
                        <span className="text-sm truncate">{commit.message}</span>
                      </div>
                      {expandedCommits.has(commit.hash) && (
                        <div className="mt-1 text-xs text-muted-foreground">
                          <span>{commit.author}</span>
                          <span className="mx-2">•</span>
                          <span>{formatDate(commit.date)}</span>
                        </div>
                      )}
                    </div>
                  </button>
                </div>
              ))}
            </div>
          </ScrollArea>
        </div>
      )}

      {/* Files section with diff viewer */}
      {files.length > 0 && (
        <div className="space-y-2">
          <button
            onClick={() => setShowFiles(!showFiles)}
            className="text-sm font-medium flex items-center gap-2 hover:text-foreground text-foreground/80 transition-colors"
          >
            {showFiles ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
            <FileCode className="h-4 w-4" />
            {t('tasks:mergedChanges.filesTitle')}
            <Badge variant="secondary" className="text-xs ml-1">{files.length}</Badge>
          </button>
          {showFiles && (
            <div className="space-y-2">
              {files.map((file: MergedFileChange, index: number) => {
                const fileKey = `${file.path}-${index}`;
                const isExpanded = expandedFiles.has(file.path);
                const hasDiff = file.hunks && file.hunks.length > 0;

                return (
                  <div
                    key={fileKey}
                    className="rounded-md border border-border/50 overflow-hidden"
                  >
                    {/* File header */}
                    <button
                      onClick={() => hasDiff && toggleFile(file.path)}
                      className={cn(
                        'w-full flex items-center gap-2 px-3 py-2 bg-muted/30 hover:bg-muted/50 transition-colors',
                        hasDiff && 'cursor-pointer',
                        !hasDiff && 'cursor-default'
                      )}
                    >
                      {hasDiff ? (
                        isExpanded ? (
                          <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
                        ) : (
                          <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                        )
                      ) : (
                        <div className="w-4" />
                      )}
                      <Badge
                        variant="outline"
                        className={cn('text-xs shrink-0', getFileStatusColor(file.status))}
                      >
                        {getFileStatusLabel(file.status)}
                      </Badge>
                      <span className="text-sm font-mono text-foreground/80 truncate flex-1 text-left">
                        {file.oldPath ? (
                          <>
                            <span className="text-muted-foreground">{file.oldPath}</span>
                            <span className="mx-1">→</span>
                            {file.path}
                          </>
                        ) : (
                          file.path
                        )}
                      </span>
                      <div className="flex items-center gap-2 text-xs shrink-0">
                        {file.additions > 0 && (
                          <span className="text-success flex items-center gap-0.5">
                            <Plus className="h-3 w-3" />
                            {file.additions}
                          </span>
                        )}
                        {file.deletions > 0 && (
                          <span className="text-destructive flex items-center gap-0.5">
                            <Minus className="h-3 w-3" />
                            {file.deletions}
                          </span>
                        )}
                      </div>
                    </button>

                    {/* Diff content */}
                    {isExpanded && hasDiff && (
                      <ScrollArea className="max-h-96">
                        <div className="bg-background border-t border-border/30">
                          {file.hunks!.map((hunk, hunkIndex) => renderDiffHunk(hunk, hunkIndex))}
                        </div>
                      </ScrollArea>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

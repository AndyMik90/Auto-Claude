import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollArea } from '../../ui/scroll-area';
import { Badge } from '../../ui/badge';
import {
  FileCode,
  Plus,
  Minus,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';
import { cn } from '../../../lib/utils';
import type { PRData } from '../../../../preload/api/modules/github-api';

interface PRFilesViewerProps {
  pr: PRData;
}

interface DiffLine {
  type: 'added' | 'removed' | 'context' | 'header';
  content: string;
  oldLineNumber?: number;
  newLineNumber?: number;
}

interface DiffHunk {
  header: string;
  oldStart: number;
  oldCount: number;
  newStart: number;
  newCount: number;
  lines: DiffLine[];
}

interface ParsedFile {
  path: string;
  additions: number;
  deletions: number;
  status: string;
  hunks: DiffHunk[];
}

/**
 * Parse a unified diff patch string into structured hunks
 */
function parsePatch(patch: string | undefined): DiffHunk[] {
  if (!patch) return [];

  const hunks: DiffHunk[] = [];
  const lines = patch.split('\n');

  let currentHunk: DiffHunk | null = null;
  let oldLineNum = 0;
  let newLineNum = 0;

  for (const line of lines) {
    // Parse hunk header: @@ -oldStart,oldCount +newStart,newCount @@
    const hunkMatch = line.match(/^@@\s+-(\d+)(?:,(\d+))?\s+\+(\d+)(?:,(\d+))?\s+@@(.*)$/);

    if (hunkMatch) {
      // Save previous hunk
      if (currentHunk) {
        hunks.push(currentHunk);
      }

      oldLineNum = parseInt(hunkMatch[1], 10);
      newLineNum = parseInt(hunkMatch[3], 10);

      currentHunk = {
        header: line,
        oldStart: oldLineNum,
        oldCount: parseInt(hunkMatch[2] || '1', 10),
        newStart: newLineNum,
        newCount: parseInt(hunkMatch[4] || '1', 10),
        lines: [],
      };

      continue;
    }

    if (!currentHunk) continue;

    // Parse diff lines
    if (line.startsWith('+')) {
      currentHunk.lines.push({
        type: 'added',
        content: line.slice(1),
        newLineNumber: newLineNum++,
      });
    } else if (line.startsWith('-')) {
      currentHunk.lines.push({
        type: 'removed',
        content: line.slice(1),
        oldLineNumber: oldLineNum++,
      });
    } else if (line.startsWith(' ') || line === '') {
      currentHunk.lines.push({
        type: 'context',
        content: line.slice(1) || '',
        oldLineNumber: oldLineNum++,
        newLineNumber: newLineNum++,
      });
    }
  }

  // Don't forget the last hunk
  if (currentHunk) {
    hunks.push(currentHunk);
  }

  return hunks;
}

export function PRFilesViewer({ pr }: PRFilesViewerProps) {
  const { t } = useTranslation(['common']);
  const [expandedFiles, setExpandedFiles] = useState<Set<string>>(new Set());
  const [showFiles, setShowFiles] = useState(true);

  // Parse all file patches
  const parsedFiles = useMemo<ParsedFile[]>(() => {
    return pr.files.map((file) => ({
      path: file.path,
      additions: file.additions,
      deletions: file.deletions,
      status: file.status,
      hunks: parsePatch(file.patch),
    }));
  }, [pr.files]);

  const toggleFile = (path: string) => {
    setExpandedFiles((prev) => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  };

  const getFileStatusColor = (status: string) => {
    switch (status) {
      case 'added':
        return 'text-success';
      case 'removed':
        return 'text-destructive';
      case 'modified':
        return 'text-warning';
      case 'renamed':
        return 'text-info';
      default:
        return 'text-muted-foreground';
    }
  };

  const getFileStatusLabel = (status: string) => {
    switch (status) {
      case 'added':
        return t('common:added');
      case 'removed':
        return t('common:deleted');
      case 'modified':
        return t('common:modified');
      case 'renamed':
        return t('common:renamed');
      default:
        return status;
    }
  };

  const renderDiffLine = (line: DiffLine, index: number) => {
    const lineClasses = cn(
      'font-mono text-xs whitespace-pre leading-5 px-2',
      line.type === 'added' && 'bg-success/20 text-success-foreground',
      line.type === 'removed' && 'bg-destructive/20 text-destructive-foreground',
      line.type === 'context' && 'text-muted-foreground'
    );

    const lineNumberClasses =
      'text-muted-foreground/50 select-none w-8 text-right pr-2 shrink-0';
    const prefixClasses = cn(
      'select-none w-4 text-center shrink-0',
      line.type === 'added' && 'text-success',
      line.type === 'removed' && 'text-destructive'
    );

    return (
      <div key={index} className={cn('flex', lineClasses)}>
        <span className={lineNumberClasses}>{line.oldLineNumber || ''}</span>
        <span className={lineNumberClasses}>{line.newLineNumber || ''}</span>
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

  if (!pr.files.length) {
    return null;
  }

  return (
    <div className="space-y-2">
      {/* Header with file toggle */}
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
        <span>{t('common:changedFiles')}</span>
        <Badge variant="secondary" className="text-xs ml-1">
          {pr.changedFiles}
        </Badge>
        <span className="text-success flex items-center gap-0.5 ml-2">
          <Plus className="h-3 w-3" />
          {pr.additions}
        </span>
        <span className="text-destructive flex items-center gap-0.5">
          <Minus className="h-3 w-3" />
          {pr.deletions}
        </span>
      </button>

      {/* Files list */}
      {showFiles && (
        <div className="space-y-2">
          {parsedFiles.map((file, index) => {
            const fileKey = `${file.path}-${index}`;
            const isExpanded = expandedFiles.has(file.path);
            const hasDiff = file.hunks.length > 0;

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
                    {file.path}
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
                      {file.hunks.map((hunk, hunkIndex) =>
                        renderDiffHunk(hunk, hunkIndex)
                      )}
                    </div>
                  </ScrollArea>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

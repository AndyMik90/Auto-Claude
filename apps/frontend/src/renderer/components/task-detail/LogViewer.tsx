/**
 * LogViewer - Enhanced log viewing dialog with filtering capabilities
 *
 * Features:
 * - Filter by phase, provider, entry type
 * - Export logs to JSON
 * - Provider/model badges for iFlow integration
 */

import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Download,
  Filter,
  Terminal,
  Cpu,
  X,
  FileText,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';
import { ScrollArea } from '../ui/scroll-area';
import { cn } from '../../lib/utils';
import type { TaskLogs, TaskLogPhase, TaskLogEntry, TaskLogEntryType } from '../../../shared/types';

interface LogViewerProps {
  isOpen: boolean;
  onClose: () => void;
  logs: TaskLogs | null;
  specId: string;
}

type ProviderFilter = 'all' | 'claude' | 'iflow';

const PHASE_LABELS: Record<TaskLogPhase, string> = {
  planning: 'Planning',
  coding: 'Coding',
  validation: 'Validation',
};

const TYPE_LABELS: Record<TaskLogEntryType, string> = {
  text: 'Messages',
  tool_start: 'Tool Start',
  tool_end: 'Tool End',
  phase_start: 'Phase Start',
  phase_end: 'Phase End',
  error: 'Errors',
  success: 'Success',
  info: 'Info',
};

export function LogViewer({ isOpen, onClose, logs, specId }: LogViewerProps) {
  const { t } = useTranslation(['tasks', 'common']);

  // Filter state
  const [phaseFilter, setPhaseFilter] = useState<TaskLogPhase | 'all'>('all');
  const [providerFilter, setProviderFilter] = useState<ProviderFilter>('all');
  const [typeFilter, setTypeFilter] = useState<TaskLogEntryType | 'all'>('all');

  // Get all entries with phase info attached
  const allEntries = useMemo(() => {
    if (!logs) return [];

    const entries: Array<TaskLogEntry & { phaseKey: TaskLogPhase; phaseProvider?: string; phaseModel?: string }> = [];

    (['planning', 'coding', 'validation'] as TaskLogPhase[]).forEach((phaseKey) => {
      const phaseLog = logs.phases[phaseKey];
      if (phaseLog?.entries) {
        phaseLog.entries.forEach((entry) => {
          entries.push({
            ...entry,
            phaseKey,
            phaseProvider: entry.provider || phaseLog.provider,
            phaseModel: entry.model || phaseLog.model,
          });
        });
      }
    });

    // Sort by timestamp
    return entries.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  }, [logs]);

  // Apply filters
  const filteredEntries = useMemo(() => {
    return allEntries.filter((entry) => {
      // Phase filter
      if (phaseFilter !== 'all' && entry.phaseKey !== phaseFilter) {
        return false;
      }

      // Provider filter
      if (providerFilter !== 'all') {
        const entryProvider = entry.phaseProvider || 'claude';
        if (entryProvider !== providerFilter) {
          return false;
        }
      }

      // Type filter
      if (typeFilter !== 'all' && entry.type !== typeFilter) {
        return false;
      }

      return true;
    });
  }, [allEntries, phaseFilter, providerFilter, typeFilter]);

  // Export logs
  const handleExport = () => {
    if (!logs) return;

    const exportData = {
      spec_id: specId,
      exported_at: new Date().toISOString(),
      filters: {
        phase: phaseFilter,
        provider: providerFilter,
        type: typeFilter,
      },
      total_entries: filteredEntries.length,
      phases: logs.phases,
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `task-logs-${specId}-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Format timestamp
  const formatTime = (timestamp: string) => {
    try {
      const date = new Date(timestamp);
      return date.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });
    } catch {
      return '';
    }
  };

  // Get entry style based on type
  const getEntryStyle = (type: TaskLogEntryType) => {
    switch (type) {
      case 'error':
        return 'text-destructive bg-destructive/5';
      case 'success':
        return 'text-success bg-success/5';
      case 'info':
        return 'text-info bg-info/5';
      case 'tool_start':
      case 'tool_end':
        return 'text-amber-500 bg-amber-500/5';
      case 'phase_start':
      case 'phase_end':
        return 'text-purple-500 bg-purple-500/5';
      default:
        return 'text-muted-foreground';
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[85vh] flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <Terminal className="h-5 w-5" />
            {t('tasks:logs.title')}
          </DialogTitle>
        </DialogHeader>

        {/* Filters */}
        <div className="flex items-center gap-3 py-3 border-b">
          <Filter className="h-4 w-4 text-muted-foreground" />

          {/* Phase filter */}
          <Select value={phaseFilter} onValueChange={(v) => setPhaseFilter(v as TaskLogPhase | 'all')}>
            <SelectTrigger className="w-[140px] h-8 text-xs">
              <SelectValue placeholder={t('tasks:logs.filter.allPhases')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('tasks:logs.filter.allPhases')}</SelectItem>
              {Object.entries(PHASE_LABELS).map(([key, label]) => (
                <SelectItem key={key} value={key}>{label}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Provider filter */}
          <Select value={providerFilter} onValueChange={(v) => setProviderFilter(v as ProviderFilter)}>
            <SelectTrigger className="w-[140px] h-8 text-xs">
              <SelectValue placeholder={t('tasks:logs.filter.allProviders')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('tasks:logs.filter.allProviders')}</SelectItem>
              <SelectItem value="claude">{t('tasks:logs.provider.claude')}</SelectItem>
              <SelectItem value="iflow">{t('tasks:logs.provider.iflow')}</SelectItem>
            </SelectContent>
          </Select>

          {/* Type filter */}
          <Select value={typeFilter} onValueChange={(v) => setTypeFilter(v as TaskLogEntryType | 'all')}>
            <SelectTrigger className="w-[140px] h-8 text-xs">
              <SelectValue placeholder={t('tasks:logs.filter.allTypes')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('tasks:logs.filter.allTypes')}</SelectItem>
              <SelectItem value="text">{TYPE_LABELS.text}</SelectItem>
              <SelectItem value="tool_start">{TYPE_LABELS.tool_start}</SelectItem>
              <SelectItem value="error">{TYPE_LABELS.error}</SelectItem>
              <SelectItem value="success">{TYPE_LABELS.success}</SelectItem>
            </SelectContent>
          </Select>

          {/* Clear filters */}
          {(phaseFilter !== 'all' || providerFilter !== 'all' || typeFilter !== 'all') && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setPhaseFilter('all');
                setProviderFilter('all');
                setTypeFilter('all');
              }}
              className="h-8 text-xs"
            >
              <X className="h-3 w-3 mr-1" />
              Clear
            </Button>
          )}

          <div className="flex-1" />

          {/* Entry count */}
          <span className="text-xs text-muted-foreground">
            {filteredEntries.length} entries
          </span>
        </div>

        {/* Log entries */}
        <ScrollArea className="flex-1 min-h-0">
          <div className="space-y-1 py-2">
            {filteredEntries.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <FileText className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">{t('tasks:logs.empty')}</p>
              </div>
            ) : (
              filteredEntries.map((entry, idx) => (
                <div
                  key={`${entry.timestamp}-${idx}`}
                  className={cn(
                    'flex items-start gap-2 px-2 py-1 text-xs rounded',
                    getEntryStyle(entry.type as TaskLogEntryType)
                  )}
                >
                  {/* Timestamp */}
                  <span className="text-[10px] text-muted-foreground/60 tabular-nums shrink-0 w-16">
                    {formatTime(entry.timestamp)}
                  </span>

                  {/* Phase badge */}
                  <Badge variant="outline" className="text-[9px] px-1 py-0 shrink-0">
                    {PHASE_LABELS[entry.phaseKey]}
                  </Badge>

                  {/* Provider badge */}
                  {entry.phaseProvider && (
                    <Badge
                      variant="outline"
                      className={cn(
                        'text-[9px] px-1 py-0 shrink-0',
                        entry.phaseProvider === 'iflow'
                          ? 'border-cyan-500/30 text-cyan-500'
                          : 'border-purple-500/30 text-purple-500'
                      )}
                    >
                      {entry.phaseProvider === 'iflow' ? 'iFlow' : 'Claude'}
                    </Badge>
                  )}

                  {/* Model */}
                  {entry.phaseModel && (
                    <span className="text-[9px] text-muted-foreground/70 shrink-0 flex items-center gap-0.5">
                      <Cpu className="h-2.5 w-2.5" />
                      {entry.phaseModel}
                    </span>
                  )}

                  {/* Type indicator */}
                  <Badge
                    variant="secondary"
                    className="text-[9px] px-1 py-0 shrink-0"
                  >
                    {entry.type}
                  </Badge>

                  {/* Content */}
                  <span className="break-words whitespace-pre-wrap flex-1">
                    {entry.content}
                  </span>
                </div>
              ))
            )}
          </div>
        </ScrollArea>

        {/* Footer with export button */}
        <div className="flex-shrink-0 flex justify-end gap-2 pt-3 border-t">
          <Button variant="outline" size="sm" onClick={handleExport} disabled={!logs}>
            <Download className="h-4 w-4 mr-2" />
            {t('tasks:logs.export')}
          </Button>
          <Button variant="default" size="sm" onClick={onClose}>
            {t('common:buttons.close')}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '../ui/button';
import { ScrollArea } from '../ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Trash2, RefreshCw } from 'lucide-react';

type LogSource = 'backend' | 'ipc' | 'frontend';

interface LogEntry {
  timestamp: string;
  level: 'info' | 'warn' | 'error' | 'debug';
  message: string;
}

export function LogViewer() {
  const { t } = useTranslation(['debug']);
  const [selectedSource, setSelectedSource] = useState<LogSource>('backend');
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const loadRecentErrors = async () => {
    if (selectedSource !== 'backend') {
      setLogs([]);
      return;
    }

    setIsLoading(true);
    try {
      const errors = await window.electronAPI.getRecentErrors(50);
      const logEntries: LogEntry[] = errors.map((error, index) => ({
        timestamp: new Date().toISOString(),
        level: 'error' as const,
        message: error
      }));
      setLogs(logEntries);
    } catch (error) {
      console.error('Failed to load recent errors:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadRecentErrors();
    const interval = setInterval(loadRecentErrors, 5000);
    return () => clearInterval(interval);
  }, [selectedSource]);

  const handleClear = () => {
    setLogs([]);
  };

  const getLevelColor = (level: LogEntry['level']) => {
    switch (level) {
      case 'error':
        return 'text-red-500';
      case 'warn':
        return 'text-yellow-500';
      case 'info':
        return 'text-blue-500';
      case 'debug':
        return 'text-muted-foreground';
      default:
        return 'text-foreground';
    }
  };

  return (
    <div className="flex flex-col h-full gap-4">
      {/* Controls */}
      <div className="flex items-center gap-4">
        <div className="flex-1">
          <label className="text-sm font-medium mb-2 block">
            {t('logs.sourceLabel')}
          </label>
          <Select value={selectedSource} onValueChange={(value) => setSelectedSource(value as LogSource)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="backend">{t('logs.sources.backend')}</SelectItem>
              <SelectItem value="ipc">{t('logs.sources.ipc')}</SelectItem>
              <SelectItem value="frontend">{t('logs.sources.frontend')}</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="self-end flex gap-2">
          <Button variant="outline" size="sm" onClick={loadRecentErrors} disabled={isLoading}>
            <RefreshCw className={`mr-2 h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            {t('logs.refreshButton')}
          </Button>
          <Button variant="outline" size="sm" onClick={handleClear}>
            <Trash2 className="mr-2 h-4 w-4" />
            {t('logs.clearButton')}
          </Button>
        </div>
      </div>

      {/* Log Display */}
      <div className="flex-1 rounded-lg border bg-muted/50 overflow-hidden">
        <ScrollArea className="h-full">
          <div className="p-4 font-mono text-sm">
            {logs.length === 0 ? (
              <p className="text-muted-foreground">{t('logs.noLogs')}</p>
            ) : (
              <div className="space-y-1">
                {logs.map((log, index) => (
                  <div key={index} className="flex gap-4">
                    <span className="text-muted-foreground">{log.timestamp}</span>
                    <span className={`font-semibold ${getLevelColor(log.level)} min-w-[60px]`}>
                      {log.level.toUpperCase()}
                    </span>
                    <span className="flex-1">{log.message}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </ScrollArea>
      </div>
    </div>
  );
}

import { useState, useEffect, useMemo } from 'react';
import { Terminal, ChevronRight, Loader2 } from 'lucide-react';
import { cn } from '../lib/utils';
import { useTaskStore } from '../stores/task-store';

const CYCLE_INTERVAL = 3000; // Cycle through tasks every 3 seconds
const MAX_LOG_LENGTH = 200; // Truncate long log lines

function cleanLogContent(content: string): string {
  return content
    .replace(/\x1b\[[0-9;]*m/g, '') // Remove ANSI codes
    .replace(/\n/g, ' ') // Replace newlines with spaces
    .trim()
    .substring(0, MAX_LOG_LENGTH);
}

function getLatestLogContent(task: {
  logs?: string[];
  executionProgress?: { message?: string; currentSubtask?: string }
}): string {
  // First try executionProgress
  if (task.executionProgress?.message) {
    return cleanLogContent(task.executionProgress.message);
  }
  if (task.executionProgress?.currentSubtask) {
    return cleanLogContent(task.executionProgress.currentSubtask);
  }

  // Then try logs array
  if (task.logs && task.logs.length > 0) {
    // Get the last meaningful log line
    for (let i = task.logs.length - 1; i >= 0; i--) {
      const log = task.logs[i].trim();
      if (log && log.length > 10) {
        return cleanLogContent(log);
      }
    }
    return cleanLogContent(task.logs[task.logs.length - 1] || '');
  }

  return 'Processing...';
}

export function TaskLogStatusBar() {
  const tasks = useTaskStore((state) => state.tasks);
  const [currentIndex, setCurrentIndex] = useState(0);

  // Memoize running tasks to prevent infinite re-renders
  const runningTasks = useMemo(
    () => tasks.filter((t) => t.status === 'in_progress'),
    [tasks]
  );

  // Reset index when running tasks change
  useEffect(() => {
    if (currentIndex >= runningTasks.length) {
      setCurrentIndex(0);
    }
  }, [runningTasks.length, currentIndex]);

  // Cycle through tasks
  useEffect(() => {
    if (runningTasks.length <= 1) {
      return;
    }

    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % runningTasks.length);
    }, CYCLE_INTERVAL);

    return () => clearInterval(interval);
  }, [runningTasks.length]);

  // No running tasks - show idle state
  if (runningTasks.length === 0) {
    return (
      <div className="h-7 bg-muted/50 border-t border-border flex items-center px-3 gap-2">
        <Terminal className="h-3.5 w-3.5 text-muted-foreground/50" />
        <span className="text-xs text-muted-foreground/50 font-mono">
          No active tasks
        </span>
      </div>
    );
  }

  // Get current task to display
  const currentTask = runningTasks[currentIndex % runningTasks.length];
  const logContent = getLatestLogContent(currentTask);

  return (
    <div className="h-7 bg-muted/50 border-t border-border flex items-center px-3 gap-2 overflow-hidden">
      {/* Activity indicator */}
      <div className="flex items-center gap-1.5 shrink-0">
        <Loader2 className="h-3.5 w-3.5 text-primary animate-spin" />
        {runningTasks.length > 1 && (
          <span className="text-[10px] text-muted-foreground tabular-nums">
            {currentIndex + 1}/{runningTasks.length}
          </span>
        )}
      </div>

      {/* Task identifier */}
      <div className="flex items-center gap-1 shrink-0">
        <span className="text-[10px] font-semibold text-primary bg-primary/10 px-1.5 py-0.5 rounded">
          {currentTask.specId || currentTask.id.substring(0, 3)}
        </span>
        <ChevronRight className="h-3 w-3 text-muted-foreground/50" />
      </div>

      {/* Log content */}
      <div className="flex-1 overflow-hidden">
        <p
          className={cn(
            "text-xs font-mono text-muted-foreground truncate",
            "animate-in fade-in slide-in-from-right-2 duration-300"
          )}
          key={`${currentTask.id}-${logContent.substring(0, 20)}`}
        >
          {logContent}
        </p>
      </div>

      {/* Task title */}
      <div
        className="shrink-0 max-w-[150px] truncate"
        title={currentTask.title}
      >
        <span className="text-[10px] text-muted-foreground/60">
          {currentTask.title}
        </span>
      </div>
    </div>
  );
}

import { Cloud, Server } from 'lucide-react';
import { cn } from '../lib/utils';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from './ui/tooltip';

type Provider = 'claude' | 'ollama';

interface TaskProviderIndicatorProps {
  provider: Provider;
  model?: string;
  isRunning?: boolean;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

const SIZE_CLASSES = {
  sm: 'h-3 w-3',
  md: 'h-4 w-4',
  lg: 'h-5 w-5',
};

const PROVIDER_COLORS = {
  claude: {
    icon: 'text-purple-500',
    bg: 'bg-purple-500/10',
    border: 'border-purple-500/20',
    running: 'animate-pulse text-purple-400',
  },
  ollama: {
    icon: 'text-green-500',
    bg: 'bg-green-500/10',
    border: 'border-green-500/20',
    running: 'animate-pulse text-green-400',
  },
};

/**
 * TaskProviderIndicator Component
 *
 * Shows which AI provider is being used for a specific task.
 * Designed to be displayed on task cards in the Kanban board.
 *
 * Features:
 * - Visual distinction between Claude (cloud) and Ollama (local)
 * - Running state animation
 * - Tooltip with provider and model details
 * - Multiple size options
 *
 * @component
 */
export function TaskProviderIndicator({
  provider,
  model,
  isRunning = false,
  className,
  size = 'sm',
}: TaskProviderIndicatorProps) {
  const Icon = provider === 'claude' ? Cloud : Server;
  const colors = PROVIDER_COLORS[provider];
  const sizeClass = SIZE_CLASSES[size];

  const indicator = (
    <div
      className={cn(
        'inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md border',
        colors.bg,
        colors.border,
        className
      )}
    >
      <Icon
        className={cn(
          sizeClass,
          isRunning ? colors.running : colors.icon
        )}
      />
      {size !== 'sm' && (
        <span className={cn('text-xs font-medium capitalize', colors.icon)}>
          {provider}
        </span>
      )}
    </div>
  );

  if (!model) {
    return indicator;
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          {indicator}
        </TooltipTrigger>
        <TooltipContent side="top" className="text-xs">
          <div className="space-y-1">
            <div className="font-medium capitalize">{provider}</div>
            <div className="text-muted-foreground font-mono">{model}</div>
            {isRunning && (
              <div className="text-green-400">Currently running</div>
            )}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

/**
 * TaskProviderBadge Component
 *
 * A larger badge variant for task detail views.
 */
export function TaskProviderBadge({
  provider,
  model,
  isRunning = false,
  className,
}: Omit<TaskProviderIndicatorProps, 'size'>) {
  const Icon = provider === 'claude' ? Cloud : Server;
  const colors = PROVIDER_COLORS[provider];

  return (
    <div
      className={cn(
        'flex items-center gap-2 px-3 py-2 rounded-lg border',
        colors.bg,
        colors.border,
        className
      )}
    >
      <Icon
        className={cn(
          'h-5 w-5',
          isRunning ? colors.running : colors.icon
        )}
      />
      <div className="flex flex-col">
        <span className={cn('text-sm font-medium capitalize', colors.icon)}>
          {provider === 'claude' ? 'Claude (Cloud)' : 'Ollama (Local)'}
        </span>
        {model && (
          <span className="text-xs text-muted-foreground font-mono">
            {model}
          </span>
        )}
      </div>
      {isRunning && (
        <div className="ml-auto flex items-center gap-1">
          <span className="relative flex h-2 w-2">
            <span className={cn(
              'animate-ping absolute inline-flex h-full w-full rounded-full opacity-75',
              provider === 'claude' ? 'bg-purple-400' : 'bg-green-400'
            )} />
            <span className={cn(
              'relative inline-flex rounded-full h-2 w-2',
              provider === 'claude' ? 'bg-purple-500' : 'bg-green-500'
            )} />
          </span>
          <span className="text-xs text-muted-foreground">Running</span>
        </div>
      )}
    </div>
  );
}

export default TaskProviderIndicator;

import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Cloud,
  Server,
  Wifi,
  WifiOff,
  AlertCircle,
  CheckCircle,
  Loader2,
  RefreshCw,
  ChevronDown,
} from 'lucide-react';
import { cn } from '../lib/utils';
import { Button } from './ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from './ui/dropdown-menu';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from './ui/tooltip';

type Provider = 'claude' | 'ollama';
type ProviderStatus = 'available' | 'unavailable' | 'degraded' | 'checking';

interface ProviderHealth {
  status: ProviderStatus;
  model_available: boolean;
  response_time_ms?: number;
  error?: string;
}

interface ProviderInfo {
  current_provider: Provider;
  fallback_active: boolean;
  primary_provider: Provider;
  fallback_provider: Provider;
  current_model: string;
  max_parallel_agents: number;
  context_window: number;
  hardware_profile?: string;
  auto_fallback_enabled: boolean;
  health: {
    claude: ProviderHealth;
    ollama: ProviderHealth;
  };
}

interface ProviderStatusBadgeProps {
  className?: string;
  showDropdown?: boolean;
  onProviderChange?: (provider: Provider) => void;
}

const STATUS_COLORS: Record<ProviderStatus, string> = {
  available: 'text-green-500',
  unavailable: 'text-red-500',
  degraded: 'text-yellow-500',
  checking: 'text-blue-500',
};

const STATUS_BG_COLORS: Record<ProviderStatus, string> = {
  available: 'bg-green-500/10',
  unavailable: 'bg-red-500/10',
  degraded: 'bg-yellow-500/10',
  checking: 'bg-blue-500/10',
};

/**
 * ProviderStatusBadge Component
 *
 * Displays the current AI provider status (Claude or Ollama) with health indicators.
 * Optionally provides a dropdown for manual provider switching.
 *
 * Features:
 * - Real-time provider health monitoring
 * - Visual status indicators (available, unavailable, degraded)
 * - Provider switching dropdown
 * - Fallback status indication
 * - Response time display
 *
 * @component
 */
export function ProviderStatusBadge({
  className,
  showDropdown = true,
  onProviderChange,
}: ProviderStatusBadgeProps) {
  const { t } = useTranslation();
  const [providerInfo, setProviderInfo] = useState<ProviderInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const fetchProviderInfo = async () => {
    try {
      // This would call the backend API to get provider info
      // For now, we'll use a mock implementation
      const result = await window.electronAPI?.getProviderInfo?.();
      if (result?.success && result?.data) {
        setProviderInfo(result.data);
      }
    } catch (error) {
      console.error('Failed to fetch provider info:', error);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchProviderInfo();
    // Refresh every 30 seconds
    const interval = setInterval(fetchProviderInfo, 30000);
    return () => clearInterval(interval);
  }, []);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await fetchProviderInfo();
  };

  const handleProviderSwitch = async (provider: Provider) => {
    if (onProviderChange) {
      onProviderChange(provider);
    }
    // Call backend to switch provider
    try {
      await window.electronAPI?.switchProvider?.(provider);
      await fetchProviderInfo();
    } catch (error) {
      console.error('Failed to switch provider:', error);
    }
  };

  if (isLoading) {
    return (
      <div className={cn('flex items-center gap-2', className)}>
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        <span className="text-sm text-muted-foreground">Loading...</span>
      </div>
    );
  }

  // Default state if no provider info
  if (!providerInfo) {
    return (
      <div className={cn('flex items-center gap-2', className)}>
        <AlertCircle className="h-4 w-4 text-yellow-500" />
        <span className="text-sm text-muted-foreground">Provider status unknown</span>
      </div>
    );
  }

  const currentProvider = providerInfo.current_provider;
  const currentHealth = providerInfo.health[currentProvider];
  const ProviderIcon = currentProvider === 'claude' ? Cloud : Server;
  const StatusIcon = currentHealth.status === 'available' ? CheckCircle :
                     currentHealth.status === 'checking' ? Loader2 : AlertCircle;

  const badge = (
    <div
      className={cn(
        'flex items-center gap-2 px-3 py-1.5 rounded-full',
        STATUS_BG_COLORS[currentHealth.status],
        className
      )}
    >
      <ProviderIcon className={cn('h-4 w-4', STATUS_COLORS[currentHealth.status])} />
      <span className="text-sm font-medium capitalize">{currentProvider}</span>
      <StatusIcon
        className={cn(
          'h-3.5 w-3.5',
          STATUS_COLORS[currentHealth.status],
          currentHealth.status === 'checking' && 'animate-spin'
        )}
      />
      {providerInfo.fallback_active && (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger>
              <WifiOff className="h-3.5 w-3.5 text-yellow-500" />
            </TooltipTrigger>
            <TooltipContent>
              <p>Fallback mode active - primary provider unavailable</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )}
      {showDropdown && <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />}
    </div>
  );

  if (!showDropdown) {
    return badge;
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="h-auto p-0 hover:bg-transparent">
          {badge}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-72">
        <DropdownMenuLabel className="flex items-center justify-between">
          <span>AI Provider</span>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0"
            onClick={handleRefresh}
            disabled={isRefreshing}
          >
            <RefreshCw className={cn('h-3.5 w-3.5', isRefreshing && 'animate-spin')} />
          </Button>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />

        {/* Claude Option */}
        <DropdownMenuItem
          className="flex items-center justify-between cursor-pointer"
          onClick={() => handleProviderSwitch('claude')}
        >
          <div className="flex items-center gap-2">
            <Cloud className={cn('h-4 w-4', STATUS_COLORS[providerInfo.health.claude.status])} />
            <div>
              <div className="font-medium">Claude</div>
              <div className="text-xs text-muted-foreground">Cloud API</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {currentProvider === 'claude' && (
              <CheckCircle className="h-4 w-4 text-green-500" />
            )}
            <span className={cn('text-xs', STATUS_COLORS[providerInfo.health.claude.status])}>
              {providerInfo.health.claude.status}
            </span>
          </div>
        </DropdownMenuItem>

        {/* Ollama Option */}
        <DropdownMenuItem
          className="flex items-center justify-between cursor-pointer"
          onClick={() => handleProviderSwitch('ollama')}
        >
          <div className="flex items-center gap-2">
            <Server className={cn('h-4 w-4', STATUS_COLORS[providerInfo.health.ollama.status])} />
            <div>
              <div className="font-medium">Ollama</div>
              <div className="text-xs text-muted-foreground">Local LLM</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {currentProvider === 'ollama' && (
              <CheckCircle className="h-4 w-4 text-green-500" />
            )}
            <span className={cn('text-xs', STATUS_COLORS[providerInfo.health.ollama.status])}>
              {providerInfo.health.ollama.status}
            </span>
          </div>
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        {/* Current Configuration */}
        <div className="px-2 py-2 text-xs text-muted-foreground space-y-1">
          <div className="flex justify-between">
            <span>Model:</span>
            <span className="font-mono">{providerInfo.current_model}</span>
          </div>
          <div className="flex justify-between">
            <span>Max Agents:</span>
            <span>{providerInfo.max_parallel_agents}</span>
          </div>
          <div className="flex justify-between">
            <span>Context Window:</span>
            <span>{providerInfo.context_window.toLocaleString()} tokens</span>
          </div>
          {providerInfo.hardware_profile && (
            <div className="flex justify-between">
              <span>Hardware Profile:</span>
              <span>{providerInfo.hardware_profile}</span>
            </div>
          )}
          <div className="flex justify-between">
            <span>Auto Fallback:</span>
            <span>{providerInfo.auto_fallback_enabled ? 'Enabled' : 'Disabled'}</span>
          </div>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export default ProviderStatusBadge;

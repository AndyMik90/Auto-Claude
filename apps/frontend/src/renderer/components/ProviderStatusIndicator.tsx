import { useState, useEffect, useCallback } from 'react';
import { Cloud, Server, AlertCircle, CheckCircle, Loader2 } from 'lucide-react';
import { cn } from '../lib/utils';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from './ui/tooltip';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from './ui/dropdown-menu';
import { Button } from './ui/button';
import { toast } from '../hooks/use-toast';

type Provider = 'claude' | 'ollama';
type ProviderStatus = 'available' | 'unavailable' | 'degraded' | 'checking';

interface ProviderHealth {
  provider: Provider;
  status: ProviderStatus;
  model_available: boolean;
  response_time_ms?: number;
  error_message?: string;
}

interface ProviderInfo {
  current_provider: Provider;
  fallback_active: boolean;
  primary_provider: Provider;
  fallback_provider: Provider;
  current_model: string;
  max_parallel_agents: number;
  context_window: number;
  hardware_profile: string | null;
  auto_fallback_enabled: boolean;
  health: {
    claude: ProviderHealth;
    ollama: ProviderHealth;
  };
}

const STATUS_COLORS: Record<ProviderStatus, string> = {
  available: 'text-green-500',
  unavailable: 'text-red-500',
  degraded: 'text-yellow-500',
  checking: 'text-blue-500',
};

const STATUS_BG: Record<ProviderStatus, string> = {
  available: 'bg-green-500/10',
  unavailable: 'bg-red-500/10',
  degraded: 'bg-yellow-500/10',
  checking: 'bg-blue-500/10',
};

/**
 * Compact provider status indicator for the sidebar
 * Shows current provider with quick-switch capability
 */
export function ProviderStatusIndicator() {
  const [providerInfo, setProviderInfo] = useState<ProviderInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSwitching, setIsSwitching] = useState(false);

  const fetchProviderInfo = useCallback(async () => {
    try {
      const result = await window.electronAPI?.getProviderInfo?.();
      if (result?.success && result.data) {
        setProviderInfo(result.data);
      }
    } catch (error) {
      console.error('Failed to fetch provider info:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProviderInfo();
    // Refresh every 30 seconds
    const interval = setInterval(fetchProviderInfo, 30000);
    return () => clearInterval(interval);
  }, [fetchProviderInfo]);

  const handleSwitch = async (provider: Provider) => {
    if (isSwitching || provider === providerInfo?.current_provider) return;

    setIsSwitching(true);
    try {
      const result = await window.electronAPI?.switchProvider?.(provider);
      if (result?.success) {
        toast({
          title: 'Provider switched',
          description: `Now using ${provider === 'claude' ? 'Claude (Cloud)' : 'Ollama (Local)'}`,
        });
        await fetchProviderInfo();
      } else {
        throw new Error(result?.error || 'Failed to switch provider');
      }
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Switch failed',
        description: error instanceof Error ? error.message : 'Failed to switch provider',
      });
    } finally {
      setIsSwitching(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 text-xs text-muted-foreground">
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        <span>Loading provider...</span>
      </div>
    );
  }

  if (!providerInfo) {
    return null;
  }

  const currentHealth = providerInfo.current_provider === 'claude'
    ? providerInfo.health.claude
    : providerInfo.health.ollama;

  const Icon = providerInfo.current_provider === 'claude' ? Cloud : Server;
  const providerLabel = providerInfo.current_provider === 'claude' ? 'Claude' : 'Ollama';

  return (
    <DropdownMenu>
      <Tooltip>
        <TooltipTrigger asChild>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className={cn(
                'w-full justify-start gap-2 h-8',
                STATUS_BG[currentHealth.status]
              )}
              disabled={isSwitching}
            >
              {isSwitching ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Icon className={cn('h-3.5 w-3.5', STATUS_COLORS[currentHealth.status])} />
              )}
              <span className="text-xs font-medium">{providerLabel}</span>
              {providerInfo.fallback_active && (
                <span className="text-[10px] text-yellow-500 ml-auto">(fallback)</span>
              )}
              {currentHealth.status === 'available' && (
                <CheckCircle className="h-3 w-3 text-green-500 ml-auto" />
              )}
              {currentHealth.status === 'unavailable' && (
                <AlertCircle className="h-3 w-3 text-red-500 ml-auto" />
              )}
            </Button>
          </DropdownMenuTrigger>
        </TooltipTrigger>
        <TooltipContent side="right">
          <div className="text-xs">
            <p className="font-medium">AI Provider: {providerLabel}</p>
            <p className="text-muted-foreground">Model: {providerInfo.current_model}</p>
            <p className="text-muted-foreground">Status: {currentHealth.status}</p>
          </div>
        </TooltipContent>
      </Tooltip>

      <DropdownMenuContent align="start" className="w-56">
        <DropdownMenuLabel className="text-xs">Switch AI Provider</DropdownMenuLabel>
        <DropdownMenuSeparator />

        {/* Claude Option */}
        <DropdownMenuItem
          onClick={() => handleSwitch('claude')}
          disabled={providerInfo.health.claude.status === 'unavailable'}
          className="flex items-center gap-2"
        >
          <Cloud className={cn(
            'h-4 w-4',
            STATUS_COLORS[providerInfo.health.claude.status]
          )} />
          <div className="flex-1">
            <span className="font-medium">Claude (Cloud)</span>
            <p className="text-xs text-muted-foreground">
              {providerInfo.health.claude.status === 'unavailable'
                ? 'No token configured'
                : 'Anthropic API'}
            </p>
          </div>
          {providerInfo.current_provider === 'claude' && (
            <CheckCircle className="h-4 w-4 text-primary" />
          )}
        </DropdownMenuItem>

        {/* Ollama Option */}
        <DropdownMenuItem
          onClick={() => handleSwitch('ollama')}
          disabled={providerInfo.health.ollama.status === 'unavailable'}
          className="flex items-center gap-2"
        >
          <Server className={cn(
            'h-4 w-4',
            STATUS_COLORS[providerInfo.health.ollama.status]
          )} />
          <div className="flex-1">
            <span className="font-medium">Ollama (Local)</span>
            <p className="text-xs text-muted-foreground">
              {providerInfo.health.ollama.status === 'unavailable'
                ? 'Not running'
                : `${providerInfo.health.ollama.response_time_ms?.toFixed(0) || '?'}ms`}
            </p>
          </div>
          {providerInfo.current_provider === 'ollama' && (
            <CheckCircle className="h-4 w-4 text-primary" />
          )}
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        {/* Current Model Info */}
        <div className="px-2 py-1.5 text-xs text-muted-foreground">
          <p>Model: <span className="font-mono">{providerInfo.current_model}</span></p>
          <p>Max Agents: {providerInfo.max_parallel_agents}</p>
          {providerInfo.auto_fallback_enabled && (
            <p className="text-yellow-600">Auto-fallback enabled</p>
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export default ProviderStatusIndicator;

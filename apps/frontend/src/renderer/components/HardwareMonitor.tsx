import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Cpu,
  MemoryStick,
  HardDrive,
  Thermometer,
  Zap,
  RefreshCw,
  AlertTriangle,
  CheckCircle,
} from 'lucide-react';
import { cn } from '../lib/utils';
import { Progress } from './ui/progress';
import { Button } from './ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from './ui/card';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from './ui/tooltip';

interface GPUInfo {
  index: number;
  name: string;
  vram_total_gb: number;
  vram_used_gb: number;
  vram_free_gb: number;
  vram_percent: number;
  utilization: number;
  temperature: number | null;
  power_draw: number | null;
}

interface HardwareInfo {
  cpu: {
    percent: number;
    cores: number;
  };
  ram: {
    total_gb: number;
    used_gb: number;
    available_gb: number;
    percent: number;
  };
  gpus: GPUInfo[];
  timestamp: string;
  recommendations: {
    max_parallel_agents: number;
    ollama_model: string;
    context_window: number;
    hardware_profile: string | null;
  };
}

interface HardwareMonitorProps {
  className?: string;
  compact?: boolean;
  showRecommendations?: boolean;
}

const getUsageColor = (percent: number): string => {
  if (percent >= 90) return 'text-red-500';
  if (percent >= 75) return 'text-yellow-500';
  return 'text-green-500';
};

const getProgressColor = (percent: number): string => {
  if (percent >= 90) return 'bg-red-500';
  if (percent >= 75) return 'bg-yellow-500';
  return 'bg-green-500';
};

/**
 * HardwareMonitor Component
 *
 * Displays real-time hardware resource usage including CPU, RAM, and GPU.
 * Provides recommendations for optimal Ollama configuration.
 *
 * Features:
 * - Real-time CPU and RAM monitoring
 * - GPU VRAM and utilization tracking
 * - Temperature and power draw display
 * - Configuration recommendations
 * - Compact and full view modes
 *
 * @component
 */
export function HardwareMonitor({
  className,
  compact = false,
  showRecommendations = true,
}: HardwareMonitorProps) {
  const { t } = useTranslation();
  const [hardware, setHardware] = useState<HardwareInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchHardwareInfo = async () => {
    try {
      const result = await window.electronAPI?.getHardwareInfo?.();
      if (result?.success && result?.data) {
        setHardware(result.data);
        setError(null);
      } else {
        setError(result?.error || 'Failed to fetch hardware info');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchHardwareInfo();
    // Refresh every 5 seconds
    const interval = setInterval(fetchHardwareInfo, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await fetchHardwareInfo();
  };

  if (isLoading) {
    return (
      <Card className={cn('animate-pulse', className)}>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Hardware Monitor</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-24 bg-muted rounded" />
        </CardContent>
      </Card>
    );
  }

  if (error || !hardware) {
    return (
      <Card className={cn('border-yellow-500/50', className)}>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-yellow-500" />
            Hardware Monitor
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            {error || 'Unable to fetch hardware information'}
          </p>
          <Button
            variant="outline"
            size="sm"
            className="mt-2"
            onClick={handleRefresh}
          >
            <RefreshCw className="h-3 w-3 mr-1" />
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (compact) {
    return (
      <div className={cn('flex items-center gap-4 text-xs', className)}>
        <TooltipProvider>
          {/* CPU */}
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex items-center gap-1">
                <Cpu className={cn('h-3.5 w-3.5', getUsageColor(hardware.cpu.percent))} />
                <span className={getUsageColor(hardware.cpu.percent)}>
                  {hardware.cpu.percent.toFixed(0)}%
                </span>
              </div>
            </TooltipTrigger>
            <TooltipContent>
              <p>CPU: {hardware.cpu.percent.toFixed(1)}% ({hardware.cpu.cores} cores)</p>
            </TooltipContent>
          </Tooltip>

          {/* RAM */}
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex items-center gap-1">
                <MemoryStick className={cn('h-3.5 w-3.5', getUsageColor(hardware.ram.percent))} />
                <span className={getUsageColor(hardware.ram.percent)}>
                  {hardware.ram.percent.toFixed(0)}%
                </span>
              </div>
            </TooltipTrigger>
            <TooltipContent>
              <p>RAM: {hardware.ram.used_gb.toFixed(1)}GB / {hardware.ram.total_gb.toFixed(1)}GB</p>
            </TooltipContent>
          </Tooltip>

          {/* GPU (if available) */}
          {hardware.gpus.length > 0 && (
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex items-center gap-1">
                  <HardDrive className={cn('h-3.5 w-3.5', getUsageColor(hardware.gpus[0].vram_percent))} />
                  <span className={getUsageColor(hardware.gpus[0].vram_percent)}>
                    {hardware.gpus[0].vram_percent.toFixed(0)}%
                  </span>
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <p>{hardware.gpus[0].name}</p>
                <p>VRAM: {hardware.gpus[0].vram_used_gb.toFixed(1)}GB / {hardware.gpus[0].vram_total_gb.toFixed(1)}GB</p>
              </TooltipContent>
            </Tooltip>
          )}
        </TooltipProvider>
      </div>
    );
  }

  return (
    <Card className={className}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm flex items-center gap-2">
            <Cpu className="h-4 w-4" />
            Hardware Monitor
          </CardTitle>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0"
            onClick={handleRefresh}
            disabled={isRefreshing}
          >
            <RefreshCw className={cn('h-3.5 w-3.5', isRefreshing && 'animate-spin')} />
          </Button>
        </div>
        <CardDescription className="text-xs">
          Real-time resource monitoring
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* CPU */}
        <div className="space-y-1">
          <div className="flex items-center justify-between text-xs">
            <span className="flex items-center gap-1">
              <Cpu className="h-3.5 w-3.5" />
              CPU ({hardware.cpu.cores} cores)
            </span>
            <span className={getUsageColor(hardware.cpu.percent)}>
              {hardware.cpu.percent.toFixed(1)}%
            </span>
          </div>
          <Progress
            value={hardware.cpu.percent}
            className="h-1.5"
            indicatorClassName={getProgressColor(hardware.cpu.percent)}
          />
        </div>

        {/* RAM */}
        <div className="space-y-1">
          <div className="flex items-center justify-between text-xs">
            <span className="flex items-center gap-1">
              <MemoryStick className="h-3.5 w-3.5" />
              RAM
            </span>
            <span className={getUsageColor(hardware.ram.percent)}>
              {hardware.ram.used_gb.toFixed(1)}GB / {hardware.ram.total_gb.toFixed(1)}GB
            </span>
          </div>
          <Progress
            value={hardware.ram.percent}
            className="h-1.5"
            indicatorClassName={getProgressColor(hardware.ram.percent)}
          />
        </div>

        {/* GPUs */}
        {hardware.gpus.map((gpu) => (
          <div key={gpu.index} className="space-y-2 pt-2 border-t">
            <div className="flex items-center justify-between text-xs">
              <span className="font-medium">{gpu.name}</span>
              {gpu.temperature && (
                <span className="flex items-center gap-1 text-muted-foreground">
                  <Thermometer className="h-3 w-3" />
                  {gpu.temperature}°C
                </span>
              )}
            </div>

            {/* VRAM */}
            <div className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="flex items-center gap-1">
                  <HardDrive className="h-3.5 w-3.5" />
                  VRAM
                </span>
                <span className={getUsageColor(gpu.vram_percent)}>
                  {gpu.vram_used_gb.toFixed(1)}GB / {gpu.vram_total_gb.toFixed(1)}GB
                </span>
              </div>
              <Progress
                value={gpu.vram_percent}
                className="h-1.5"
                indicatorClassName={getProgressColor(gpu.vram_percent)}
              />
            </div>

            {/* GPU Utilization */}
            <div className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span>GPU Utilization</span>
                <span className={getUsageColor(gpu.utilization)}>
                  {gpu.utilization.toFixed(0)}%
                </span>
              </div>
              <Progress
                value={gpu.utilization}
                className="h-1.5"
                indicatorClassName={getProgressColor(gpu.utilization)}
              />
            </div>

            {/* Power Draw */}
            {gpu.power_draw && (
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Zap className="h-3 w-3" />
                  Power Draw
                </span>
                <span>{gpu.power_draw.toFixed(0)}W</span>
              </div>
            )}
          </div>
        ))}

        {/* Recommendations */}
        {showRecommendations && hardware.recommendations && (
          <div className="pt-2 border-t space-y-2">
            <div className="flex items-center gap-1 text-xs font-medium">
              <CheckCircle className="h-3.5 w-3.5 text-green-500" />
              Recommended Settings
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
              <div>
                <span className="text-foreground">Model:</span>
                <br />
                <span className="font-mono">{hardware.recommendations.ollama_model}</span>
              </div>
              <div>
                <span className="text-foreground">Max Agents:</span>
                <br />
                {hardware.recommendations.max_parallel_agents}
              </div>
              <div>
                <span className="text-foreground">Context:</span>
                <br />
                {hardware.recommendations.context_window.toLocaleString()} tokens
              </div>
              {hardware.recommendations.hardware_profile && (
                <div>
                  <span className="text-foreground">Profile:</span>
                  <br />
                  {hardware.recommendations.hardware_profile}
                </div>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default HardwareMonitor;

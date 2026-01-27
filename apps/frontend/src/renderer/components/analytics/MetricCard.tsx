import { type ReactNode } from 'react';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { Card, CardContent } from '../ui/card';
import { cn } from '../../lib/utils';

/**
 * Trend direction for metric comparison
 */
export type TrendDirection = 'up' | 'down' | 'neutral';

/**
 * Props for the MetricCard component
 */
export interface MetricCardProps {
  /** The label describing the metric */
  label: string;
  /** The primary value to display */
  value: string | number;
  /** Optional sub-label for additional context */
  subLabel?: string;
  /** Optional icon to display */
  icon?: ReactNode;
  /** Optional trend direction for comparison */
  trend?: TrendDirection;
  /** Optional trend value (e.g., "+12%") */
  trendValue?: string;
  /** Optional click handler for drill-down navigation */
  onClick?: () => void;
  /** Whether the card is clickable (shows hover state) */
  clickable?: boolean;
  /** Optional additional className */
  className?: string;
  /** Optional loading state */
  isLoading?: boolean;
  /** Optional tooltip text */
  tooltip?: string;
  /** Color variant for the metric value */
  variant?: 'default' | 'success' | 'warning' | 'error';
}

/**
 * Reusable MetricCard component for displaying individual metrics
 * with label, value, and optional trend indicator.
 *
 * @example
 * ```tsx
 * <MetricCard
 *   label={t('analytics:metrics.tokenUsage.total')}
 *   value={1250000}
 *   icon={<Coins className="h-4 w-4" />}
 *   trend="up"
 *   trendValue="+12%"
 *   onClick={() => drillDown('tokens')}
 * />
 * ```
 */
export function MetricCard({
  label,
  value,
  subLabel,
  icon,
  trend,
  trendValue,
  onClick,
  clickable = false,
  className,
  isLoading = false,
  tooltip,
  variant = 'default',
}: MetricCardProps) {
  const isInteractive = clickable || !!onClick;

  const getTrendIcon = () => {
    switch (trend) {
      case 'up':
        return <TrendingUp className="h-3 w-3" />;
      case 'down':
        return <TrendingDown className="h-3 w-3" />;
      case 'neutral':
        return <Minus className="h-3 w-3" />;
      default:
        return null;
    }
  };

  const getTrendColor = () => {
    switch (trend) {
      case 'up':
        return 'text-green-500';
      case 'down':
        return 'text-red-500';
      case 'neutral':
        return 'text-muted-foreground';
      default:
        return 'text-muted-foreground';
    }
  };

  const getValueColor = () => {
    switch (variant) {
      case 'success':
        return 'text-green-500';
      case 'warning':
        return 'text-yellow-500';
      case 'error':
        return 'text-red-500';
      default:
        return 'text-foreground';
    }
  };

  const formatValue = (val: string | number): string => {
    if (typeof val === 'number') {
      // Format large numbers with locale-specific separators
      if (val >= 1000000) {
        return `${(val / 1000000).toFixed(1)}M`;
      }
      if (val >= 1000) {
        return `${(val / 1000).toFixed(1)}K`;
      }
      // For percentages or small decimals, show one decimal place
      if (!Number.isInteger(val)) {
        return val.toFixed(1);
      }
      return val.toLocaleString();
    }
    return val;
  };

  return (
    <Card
      className={cn(
        'relative overflow-hidden',
        isInteractive && 'cursor-pointer hover:border-primary/50 hover:shadow-md',
        className
      )}
      onClick={isInteractive ? onClick : undefined}
      title={tooltip}
      role={isInteractive ? 'button' : undefined}
      tabIndex={isInteractive ? 0 : undefined}
      onKeyDown={
        isInteractive
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onClick?.();
              }
            }
          : undefined
      }
    >
      <CardContent className="p-4">
        {isLoading ? (
          <div className="space-y-2 animate-pulse">
            <div className="h-4 w-20 bg-muted rounded" />
            <div className="h-8 w-24 bg-muted rounded" />
          </div>
        ) : (
          <>
            {/* Header with label and icon */}
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-muted-foreground">
                {label}
              </span>
              {icon && (
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  {icon}
                </div>
              )}
            </div>

            {/* Value */}
            <div className="flex items-baseline gap-2">
              <span className={cn('text-2xl font-bold', getValueColor())}>
                {formatValue(value)}
              </span>
              {subLabel && (
                <span className="text-sm text-muted-foreground">{subLabel}</span>
              )}
            </div>

            {/* Trend indicator */}
            {trend && trendValue && (
              <div className={cn('mt-2 flex items-center gap-1 text-xs', getTrendColor())}>
                {getTrendIcon()}
                <span>{trendValue}</span>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

/**
 * Compact variant of MetricCard for inline displays
 */
export interface CompactMetricCardProps {
  label: string;
  value: string | number;
  className?: string;
}

export function CompactMetricCard({ label, value, className }: CompactMetricCardProps) {
  return (
    <div className={cn('flex flex-col', className)}>
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-lg font-semibold text-foreground">
        {typeof value === 'number' ? value.toLocaleString() : value}
      </span>
    </div>
  );
}

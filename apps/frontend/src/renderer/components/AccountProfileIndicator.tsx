import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { User, Loader2, AlertTriangle } from 'lucide-react';
import { Button } from './ui/button';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
import { Tooltip, TooltipContent, TooltipTrigger } from './ui/tooltip';
import { cn } from '../lib/utils';
import { useUsageStore, loadUsageData, subscribeToUsageUpdates } from '../stores/usage-store';

interface AccountProfileIndicatorProps {
  className?: string;
}

/**
 * Get the color class for a usage percentage based on thresholds.
 * Color thresholds: green (0-70), yellow (71-90), orange (91-94), red (95+)
 */
function getUsageColor(percent: number): string {
  if (percent >= 95) return 'bg-red-500';
  if (percent >= 91) return 'bg-orange-500';
  if (percent >= 71) return 'bg-yellow-500';
  return 'bg-green-500';
}

/**
 * Get the text color class for a usage percentage.
 */
function getUsageTextColor(percent: number): string {
  if (percent >= 95) return 'text-red-500';
  if (percent >= 91) return 'text-orange-500';
  if (percent >= 71) return 'text-yellow-500';
  return 'text-green-500';
}

/**
 * Get status indicator color based on maximum usage across all limits.
 */
function getStatusIndicatorColor(
  sessionPercent: number,
  weeklyPercent: number,
  sonnetPercent?: number
): string {
  const maxUsage = Math.max(sessionPercent, weeklyPercent, sonnetPercent ?? 0);
  return getUsageColor(maxUsage);
}

/**
 * Progress bar component for usage display.
 */
function UsageProgressBar({ percent }: { percent: number }) {
  return (
    <div className="mt-1.5 h-1.5 bg-muted rounded-full overflow-hidden">
      <div
        className={cn('h-full transition-all', getUsageColor(percent))}
        style={{ width: `${Math.min(percent, 100)}%` }}
      />
    </div>
  );
}

/**
 * Account Profile Indicator - Sidebar component showing active Claude account
 * and detailed rate limit information on hover/click.
 *
 * Displays:
 * - Minimalistic trigger with profile name and status indicator
 * - Detailed popup with session, weekly, and Sonnet usage
 * - Color-coded progress bars based on usage thresholds
 */
export function AccountProfileIndicator({ className }: AccountProfileIndicatorProps) {
  const { t } = useTranslation(['navigation', 'common']);
  const [isOpen, setIsOpen] = useState(false);

  // Get usage state from Zustand store
  const { usage, isLoading, error } = useUsageStore();

  // Load initial data and subscribe to updates on mount
  useEffect(() => {
    loadUsageData();
    const unsubscribe = subscribeToUsageUpdates();
    return () => unsubscribe();
  }, []);

  // Determine status indicator color
  const statusColor = usage
    ? getStatusIndicatorColor(
        usage.sessionPercent,
        usage.weeklyPercent,
        usage.sonnetWeeklyPercent
      )
    : 'bg-muted-foreground';

  // Get tooltip text based on current state
  const getTooltipText = () => {
    if (isLoading) {
      return t('navigation:accountProfile.loading');
    }
    if (error) {
      return t('navigation:accountProfile.error');
    }
    if (!usage) {
      return t('navigation:accountProfile.noData');
    }
    return t('navigation:accountProfile.viewUsage');
  };

  // Truncate profile name if too long
  const displayName = usage?.profileName
    ? usage.profileName.length > 20
      ? `${usage.profileName.substring(0, 17)}...`
      : usage.profileName
    : t('navigation:accountProfile.noProfile');

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <Tooltip>
        <TooltipTrigger asChild>
          <PopoverTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className={cn(
                'w-full justify-start gap-2 text-xs',
                error ? 'text-destructive' : '',
                className
              )}
            >
              <div className="relative">
                {isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : error ? (
                  <AlertTriangle className="h-4 w-4" />
                ) : (
                  <User className="h-4 w-4" />
                )}
                {!isLoading && (
                  <span
                    className={cn(
                      'absolute -bottom-0.5 -right-0.5 h-2 w-2 rounded-full',
                      statusColor
                    )}
                  />
                )}
              </div>
              <span className="truncate">{displayName}</span>
            </Button>
          </PopoverTrigger>
        </TooltipTrigger>
        <TooltipContent side="right">{getTooltipText()}</TooltipContent>
      </Tooltip>

      <PopoverContent side="right" align="end" className="w-72">
        <div className="space-y-3">
          {/* Header */}
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
              <User className="h-4 w-4 text-primary" />
            </div>
            <div>
              <h4 className="text-sm font-medium">
                {usage?.profileName || t('navigation:accountProfile.noProfile')}
              </h4>
              <p className="text-xs text-muted-foreground">
                {t('navigation:accountProfile.title')}
              </p>
            </div>
          </div>

          {/* Loading state */}
          {isLoading && (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              <span className="ml-2 text-sm text-muted-foreground">
                {t('navigation:accountProfile.loading')}
              </span>
            </div>
          )}

          {/* Error state */}
          {error && !isLoading && (
            <div className="text-xs p-2 bg-destructive/10 text-destructive rounded-md flex items-center gap-2">
              <AlertTriangle className="h-3 w-3 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* No data state */}
          {!usage && !isLoading && !error && (
            <div className="text-xs p-2 bg-muted rounded-md text-muted-foreground text-center">
              {t('navigation:accountProfile.noData')}
            </div>
          )}

          {/* Usage data */}
          {usage && !isLoading && (
            <div className="space-y-3">
              {/* Session Usage */}
              <div className="p-2 bg-muted rounded-md">
                <div className="flex items-center justify-between gap-4 mb-1">
                  <span className="text-xs text-muted-foreground font-medium">
                    {t('navigation:accountProfile.sessionUsage')}
                  </span>
                  <span
                    className={cn(
                      'text-xs font-semibold tabular-nums',
                      getUsageTextColor(usage.sessionPercent)
                    )}
                  >
                    {Math.round(usage.sessionPercent)}%
                  </span>
                </div>
                <UsageProgressBar percent={usage.sessionPercent} />
                {usage.sessionResetTime && (
                  <div className="text-[10px] text-muted-foreground mt-1">
                    {t('navigation:accountProfile.resetsAt', { time: usage.sessionResetTime })}
                  </div>
                )}
              </div>

              {/* Weekly Usage (All Models) */}
              <div className="p-2 bg-muted rounded-md">
                <div className="flex items-center justify-between gap-4 mb-1">
                  <span className="text-xs text-muted-foreground font-medium">
                    {t('navigation:accountProfile.weeklyUsage')}
                  </span>
                  <span
                    className={cn(
                      'text-xs font-semibold tabular-nums',
                      getUsageTextColor(usage.weeklyPercent)
                    )}
                  >
                    {Math.round(usage.weeklyPercent)}%
                  </span>
                </div>
                <UsageProgressBar percent={usage.weeklyPercent} />
                {usage.weeklyResetTime && (
                  <div className="text-[10px] text-muted-foreground mt-1">
                    {t('navigation:accountProfile.resetsAt', { time: usage.weeklyResetTime })}
                  </div>
                )}
              </div>

              {/* Sonnet Weekly Usage - only show if data available */}
              {usage.sonnetWeeklyPercent !== undefined && (
                <div className="p-2 bg-muted rounded-md">
                  <div className="flex items-center justify-between gap-4 mb-1">
                    <span className="text-xs text-muted-foreground font-medium">
                      {t('navigation:accountProfile.sonnetUsage')}
                    </span>
                    <span
                      className={cn(
                        'text-xs font-semibold tabular-nums',
                        getUsageTextColor(usage.sonnetWeeklyPercent)
                      )}
                    >
                      {Math.round(usage.sonnetWeeklyPercent)}%
                    </span>
                  </div>
                  <UsageProgressBar percent={usage.sonnetWeeklyPercent} />
                  {usage.sonnetWeeklyResetTime && (
                    <div className="text-[10px] text-muted-foreground mt-1">
                      {t('navigation:accountProfile.resetsAt', { time: usage.sonnetWeeklyResetTime })}
                    </div>
                  )}
                </div>
              )}

              {/* Last updated timestamp */}
              {usage.fetchedAt && (
                <div className="text-[10px] text-muted-foreground text-center">
                  {t('navigation:accountProfile.lastUpdated', {
                    time: new Date(usage.fetchedAt).toLocaleTimeString()
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

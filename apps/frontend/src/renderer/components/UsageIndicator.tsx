/**
 * Usage Indicator - Real-time Claude usage display in header
 *
 * Displays current session/weekly usage as a badge with color-coded status.
 * Shows detailed breakdown on hover.
 */

import React, { useState, useEffect } from 'react';
import { Activity, TrendingUp, AlertCircle } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from './ui/tooltip';
import { useTranslation } from 'react-i18next';
import type { ClaudeUsageSnapshot } from '../../shared/types/agent';

export function UsageIndicator() {
  const { t } = useTranslation(['common', 'usage']);
  const [usage, setUsage] = useState<ClaudeUsageSnapshot | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAvailable, setIsAvailable] = useState(false);

  // Helper function to format large numbers with units (K, M, B)
  const formatUsageValue = (value?: number): string | undefined => {
    if (value === undefined) return undefined;

    if (value >= 1_000_000_000) {
      return `${(value / 1_000_000_000).toFixed(2)} B`;
    } else if (value >= 1_000_000) {
      return `${(value / 1_000_000).toFixed(2)} M`;
    } else if (value >= 1_000) {
      return `${(value / 1_000).toFixed(1)} K`;
    }
    return value.toString();
  };

  // Helper function to calculate formatted reset time from timestamp
  const formatResetTime = (timestamp?: string): string | undefined => {
    if (!timestamp) return undefined;

    try {
      const date = new Date(timestamp);
      const now = new Date();
      const diffMs = date.getTime() - now.getTime();
      const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
      const diffMins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

      if (diffHours < 24) {
        return t('usage:resetsInHours', { hours: diffHours, minutes: diffMins });
      }

      const diffDays = Math.floor(diffHours / 24);
      const remainingHours = diffHours % 24;
      return t('usage:resetsInDays', { days: diffDays, hours: remainingHours });
    } catch (_error) {
      return undefined;
    }
  };

  // Get formatted reset times (calculated dynamically from timestamps)
  const sessionResetTime = usage?.sessionResetTimestamp
    ? formatResetTime(usage.sessionResetTimestamp)
    : usage?.sessionResetTime;
  const weeklyResetTime = usage?.weeklyResetTimestamp
    ? formatResetTime(usage.weeklyResetTimestamp)
    : usage?.weeklyResetTime;

  useEffect(() => {
    // Listen for usage updates from main process
    const unsubscribe = window.electronAPI.onUsageUpdated((snapshot: ClaudeUsageSnapshot) => {
      setUsage(snapshot);
      setIsAvailable(true);
      setIsLoading(false);
    });

    // Request initial usage on mount
    window.electronAPI.requestUsageUpdate().then((result) => {
      setIsLoading(false);
      if (result.success && result.data) {
        setUsage(result.data);
        setIsAvailable(true);
      } else {
        // No usage data available (endpoint not supported or error)
        setIsAvailable(false);
      }
    }).catch(() => {
      // Handle errors (IPC failure, network issues, etc.)
      setIsLoading(false);
      setIsAvailable(false);
    });

    return () => {
      unsubscribe();
    };
  }, []);

  // Always show the badge, but display different states
  // Show loading state initially
  if (isLoading) {
    return (
      <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border bg-muted/50 text-muted-foreground">
        <Activity className="h-3.5 w-3.5 animate-pulse" />
        <span className="text-xs font-semibold">...</span>
      </div>
    );
  }

  // Show unavailable state when endpoint doesn't return data
  if (!isAvailable || !usage) {
    return (
      <TooltipProvider delayDuration={200}>
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border bg-muted/50 text-muted-foreground cursor-help">
              <Activity className="h-3.5 w-3.5" />
              <span className="text-xs font-semibold">{t('usage:notAvailable')}</span>
            </div>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="text-xs w-64">
            <div className="space-y-1">
              <p className="font-medium">{t('usage:dataUnavailable')}</p>
              <p className="text-muted-foreground text-[10px]">
                {t('usage:dataUnavailableDescription')}
              </p>
            </div>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  // Determine color based on session usage (5-hour window)
  // This is what should be shown on the badge per QA feedback
  const badgeUsage = usage.sessionPercent;
  const badgeColorClasses =
    badgeUsage >= 95 ? 'text-red-500 bg-red-500/10 border-red-500/20' :
    badgeUsage >= 91 ? 'text-orange-500 bg-orange-500/10 border-orange-500/20' :
    badgeUsage >= 71 ? 'text-yellow-500 bg-yellow-500/10 border-yellow-500/20' :
    'text-green-500 bg-green-500/10 border-green-500/20';

  // Get window labels for display
  const sessionLabel = usage.usageWindows?.sessionWindowLabel || t('usage:sessionDefault');
  const weeklyLabel = usage.usageWindows?.weeklyWindowLabel || t('usage:weeklyDefault');

  // For icon, use the highest of the two windows
  const maxUsage = Math.max(usage.sessionPercent, usage.weeklyPercent);
  const Icon =
    maxUsage >= 91 ? AlertCircle :
    maxUsage >= 71 ? TrendingUp :
    Activity;

  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border transition-all hover:opacity-80 ${badgeColorClasses}`}
            aria-label={t('usage:usageStatusAriaLabel')}
          >
            <Icon className="h-3.5 w-3.5" />
            <span className="text-xs font-semibold font-mono">
              {Math.round(badgeUsage)}%
            </span>
          </button>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="text-xs w-64">
          <div className="space-y-2">
            {/* Session/5-hour usage */}
            <div>
              <div className="flex items-center justify-between gap-4 mb-1">
                <span className="text-muted-foreground font-medium">{sessionLabel}</span>
                <span className="font-semibold tabular-nums">{Math.round(usage.sessionPercent)}%</span>
              </div>
              {sessionResetTime && (
                <div className="text-[10px] text-muted-foreground">
                  {sessionResetTime}
                </div>
              )}
              {/* Progress bar */}
              <div className="mt-1.5 h-1.5 bg-muted rounded-full overflow-hidden">
                <div
                  className={`h-full transition-all ${
                    usage.sessionPercent >= 95 ? 'bg-red-500' :
                    usage.sessionPercent >= 91 ? 'bg-orange-500' :
                    usage.sessionPercent >= 71 ? 'bg-yellow-500' :
                    'bg-green-500'
                  }`}
                  style={{ width: `${Math.min(usage.sessionPercent, 100)}%` }}
                />
              </div>
              {/* Raw usage value below the bar */}
              {usage.sessionUsageValue !== undefined && usage.sessionUsageLimit !== undefined && (
                <div className="mt-1 text-[10px] text-muted-foreground tabular-nums">
                  {formatUsageValue(usage.sessionUsageValue)} / {formatUsageValue(usage.sessionUsageLimit)}
                </div>
              )}
            </div>

            <div className="h-px bg-border" />

            {/* Weekly/Monthly usage */}
            <div>
              <div className="flex items-center justify-between gap-4 mb-1">
                <span className="text-muted-foreground font-medium">{weeklyLabel}</span>
                <span className="font-semibold tabular-nums">{Math.round(usage.weeklyPercent)}%</span>
              </div>
              {weeklyResetTime && (
                <div className="text-[10px] text-muted-foreground">
                  {weeklyResetTime}
                </div>
              )}
              {/* Progress bar */}
              <div className="mt-1.5 h-1.5 bg-muted rounded-full overflow-hidden">
                <div
                  className={`h-full transition-all ${
                    usage.weeklyPercent >= 99 ? 'bg-red-500' :
                    usage.weeklyPercent >= 91 ? 'bg-orange-500' :
                    usage.weeklyPercent >= 71 ? 'bg-yellow-500' :
                    'bg-green-500'
                  }`}
                  style={{ width: `${Math.min(usage.weeklyPercent, 100)}%` }}
                />
              </div>
              {/* Raw usage value below the bar */}
              {usage.weeklyUsageValue !== undefined && usage.weeklyUsageLimit !== undefined && (
                <div className="mt-1 text-[10px] text-muted-foreground tabular-nums">
                  {formatUsageValue(usage.weeklyUsageValue)} / {formatUsageValue(usage.weeklyUsageLimit)}
                </div>
              )}
            </div>

            <div className="h-px bg-border" />

            {/* Active profile */}
            <div className="flex items-center justify-between gap-4 pt-1">
              <span className="text-muted-foreground text-[10px] uppercase tracking-wide">{t('usage:activeAccount')}</span>
              <span className="font-semibold text-primary">{usage.profileName}</span>
            </div>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

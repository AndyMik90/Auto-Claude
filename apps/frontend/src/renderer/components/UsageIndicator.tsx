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
import { formatTimeRemaining } from '../../shared/utils/format-time';
import type { ClaudeUsageSnapshot } from '../../shared/types/agent';

export function UsageIndicator() {
  const { t, i18n } = useTranslation(['common']);
  const [usage, setUsage] = useState<ClaudeUsageSnapshot | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAvailable, setIsAvailable] = useState(false);

  // Helper function to format large numbers with locale-aware compact notation
  const formatUsageValue = (value?: number): string | undefined => {
    if (value === undefined) return undefined;

    // Use Intl.NumberFormat for locale-aware compact number formatting
    // Fallback to toString() if Intl is not available
    if (typeof Intl !== 'undefined' && Intl.NumberFormat) {
      try {
        return new Intl.NumberFormat(i18n.language, {
          notation: 'compact',
          compactDisplay: 'short',
          maximumFractionDigits: 2
        }).format(value);
      } catch {
        // Intl may fail in some environments, fall back to toString()
      }
    }
    return value.toString();
  };

  // Map backend-provided usage window labels to translation keys
  // Backend provides English strings like "5-hour window", "7-day window", etc.
  // These need to be localized for the user interface
  const localizeUsageWindowLabel = (backendLabel?: string): string => {
    if (!backendLabel) return t('common:usage.sessionDefault');

    // Map known backend labels to translation keys
    const labelMap: Record<string, string> = {
      '5-hour window': 'window5Hour',
      '7-day window': 'window7Day',
      '5 Hours Quota': 'window5HoursQuota',
      'Monthly Tools Quota': 'windowMonthlyToolsQuota'
    };

    const translationKey = labelMap[backendLabel];
    if (translationKey) {
      const translated = t(`common:usage.${translationKey}`);
      // If translation returns the key itself (not found), use backend label as fallback
      return translated === `common:usage.${translationKey}` ? backendLabel : translated;
    }

    // Unknown label - use as-is (should be rare)
    return backendLabel;
  };

  // Get formatted reset times (calculated dynamically from timestamps)
  // Note: We don't fall back to sessionResetTime/weeklyResetTime when formatTimeRemaining
  // returns undefined because those may contain stale "Resets in ..." placeholders from the
  // backend that are incorrect after the window has reset.
  const sessionResetTime = usage?.sessionResetTimestamp
    ? formatTimeRemaining(usage.sessionResetTimestamp, t)
    : usage?.sessionResetTime;
  const weeklyResetTime = usage?.weeklyResetTimestamp
    ? formatTimeRemaining(usage.weeklyResetTimestamp, t)
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
              <span className="text-xs font-semibold">{t('common:usage.notAvailable')}</span>
            </div>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="text-xs w-64">
            <div className="space-y-1">
              <p className="font-medium">{t('common:usage.dataUnavailable')}</p>
              <p className="text-muted-foreground text-[10px]">
                {t('common:usage.dataUnavailableDescription')}
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
  // Map backend-provided labels to localized versions
  const sessionLabel = localizeUsageWindowLabel(usage?.usageWindows?.sessionWindowLabel);
  const weeklyLabel = localizeUsageWindowLabel(usage?.usageWindows?.weeklyWindowLabel);

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
            aria-label={t('common:usage.usageStatusAriaLabel')}
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
              <span className="text-muted-foreground text-[10px] uppercase tracking-wide">{t('common:usage.activeAccount')}</span>
              <span className="font-semibold text-primary">{usage.profileName}</span>
            </div>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

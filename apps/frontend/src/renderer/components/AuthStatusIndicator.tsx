/**
 * AuthStatusIndicator - Display current authentication method in header
 *
 * Shows the active authentication method and provider:
 * - OAuth: Shows "OAuth Anthropic" with Lock icon
 * - API Profile: Shows provider name (z.ai, ZHIPU AI) with Key icon and provider-specific colors
 *
 * Provider detection is based on the profile's baseUrl:
 * - api.anthropic.com → Anthropic
 * - api.z.ai → z.ai
 * - open.bigmodel.cn, dev.bigmodel.cn → ZHIPU AI
 *
 * Usage warning badge: Shows to the left of provider badge when usage exceeds 90%
 */

import { useMemo, useState, useEffect } from 'react';
import { Key, Lock, Cloud, AlertTriangle } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from './ui/tooltip';
import { useSettingsStore } from '../stores/settings-store';
import { detectProvider, getProviderLabel, getProviderBadgeColor } from '../../shared/utils/provider-detection';
import type { ClaudeUsageSnapshot } from '../../shared/types/agent';

export function AuthStatusIndicator() {
  // Subscribe to profile state from settings store
  const { profiles, activeProfileId } = useSettingsStore();

  // Track usage data for warning badge
  const [usage, setUsage] = useState<ClaudeUsageSnapshot | null>(null);
  const [isLoadingUsage, setIsLoadingUsage] = useState(true);

  // Listen for usage updates
  useEffect(() => {
    const unsubscribe = window.electronAPI.onUsageUpdated((snapshot: ClaudeUsageSnapshot) => {
      setUsage(snapshot);
      setIsLoadingUsage(false);
    });

    // Request initial usage
    window.electronAPI.requestUsageUpdate().then((result) => {
      setIsLoadingUsage(false);
      if (result.success && result.data) {
        setUsage(result.data);
      }
    });

    return () => {
      unsubscribe();
    };
  }, []);

  // Determine if usage warning badge should be shown
  const shouldShowUsageWarning = usage && !isLoadingUsage && (
    usage.sessionPercent >= 90 || usage.weeklyPercent >= 90
  );

  // Get the higher usage percentage for the warning badge
  const warningBadgePercent = usage
    ? Math.max(usage.sessionPercent, usage.weeklyPercent)
    : 0;

  // Get countdown text for reset time (use the window that's closer to limit)
  const getResetCountdown = () => {
    if (!usage) return null;

    // Use the window that has higher usage percentage
    const isSession = usage.sessionPercent >= usage.weeklyPercent;
    const resetTime = isSession ? usage.sessionResetTime : usage.weeklyResetTime;
    const label = isSession
      ? (usage.usageWindows?.sessionWindowLabel || 'Session')
      : (usage.usageWindows?.weeklyWindowLabel || 'Weekly');

    // Extract time information from resetTime
    // Format: "Resets in Xh Ym" or "1st of MonthName"
    if (resetTime && resetTime !== 'Unknown') {
      return `${label}: ${resetTime}`;
    }
    return null;
  };

  const resetCountdown = getResetCountdown();

  // Compute auth status and provider detection using useMemo to avoid unnecessary re-renders
  const authStatus = useMemo(() => {
    if (activeProfileId) {
      const activeProfile = profiles.find(p => p.id === activeProfileId);
      if (activeProfile) {
        // Detect provider from profile's baseUrl
        const provider = detectProvider(activeProfile.baseUrl);
        const providerLabel = getProviderLabel(provider);
        return {
          type: 'profile' as const,
          name: activeProfile.name,
          provider,
          providerLabel,
          badgeColor: getProviderBadgeColor(provider)
        };
      }
      // Profile ID set but profile not found - fallback to OAuth
      return {
        type: 'oauth' as const,
        name: 'OAuth',
        provider: 'anthropic' as const,
        providerLabel: 'Anthropic',
        badgeColor: 'bg-orange-500/10 text-orange-500 border-orange-500/20 hover:bg-orange-500/15'
      };
    }
    // No active profile - using OAuth
    return {
      type: 'oauth' as const,
      name: 'OAuth',
      provider: 'anthropic' as const,
      providerLabel: 'Anthropic',
      badgeColor: 'bg-orange-500/10 text-orange-500 border-orange-500/20 hover:bg-orange-500/15'
    };
  }, [activeProfileId, profiles]);

  const isOAuth = authStatus.type === 'oauth';
  const Icon = isOAuth ? Lock : Key;

  return (
    <div className="flex items-center gap-2">
      {/* Usage Warning Badge (shown when usage >= 90%) */}
      {shouldShowUsageWarning && resetCountdown && (
        <TooltipProvider delayDuration={200}>
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border bg-red-500/10 text-red-500 border-red-500/20">
                <AlertTriangle className="h-3.5 w-3.5 animate-pulse" />
                <span className="text-xs font-semibold font-mono">
                  {Math.round(warningBadgePercent)}%
                </span>
              </div>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="text-xs max-w-xs">
              <div className="space-y-1">
                <div className="flex items-center justify-between gap-4">
                  <span className="text-muted-foreground font-medium">Usage Alert</span>
                  <span className="font-semibold text-red-500">{Math.round(warningBadgePercent)}%</span>
                </div>
                <div className="text-[10px] text-muted-foreground">
                  {resetCountdown}
                </div>
                <div className="h-px bg-border" />
                <div className="text-[10px] text-muted-foreground">
                  Account usage exceeds 90% threshold
                </div>
              </div>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )}

      {/* Provider Badge */}
      <TooltipProvider delayDuration={200}>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border transition-all hover:opacity-80 ${authStatus.badgeColor}`}
              aria-label={`Authentication: ${authStatus.providerLabel}`}
            >
              <Icon className="h-3.5 w-3.5" />
              <span className="text-xs font-semibold">
                {authStatus.providerLabel}
              </span>
            </button>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="text-xs max-w-xs">
            <div className="space-y-1">
              <div className="flex items-center justify-between gap-4">
                <span className="text-muted-foreground font-medium">Authentication</span>
                <span className="font-semibold">{isOAuth ? 'OAuth' : 'API Profile'}</span>
              </div>
              <div className="flex items-center justify-between gap-4">
                <span className="text-muted-foreground font-medium">Provider</span>
                <span className="font-semibold">{authStatus.providerLabel}</span>
              </div>
              {!isOAuth && authStatus.name && (
                <>
                  <div className="h-px bg-border" />
                  <div className="text-[10px] text-muted-foreground">
                    Using profile: <span className="text-foreground font-medium">{authStatus.name}</span>
                  </div>
                </>
              )}
            </div>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </div>
  );
}

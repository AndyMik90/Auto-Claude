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
        return `Resets in ${diffHours}h ${diffMins}m`;
      }

      const diffDays = Math.floor(diffHours / 24);
      const remainingHours = diffHours % 24;
      return `Resets in ${diffDays}d ${remainingHours}h`;
    } catch (_error) {
      return undefined;
    }
  };

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

  // Get formatted reset times (calculated dynamically from timestamps)
  const sessionResetTime = usage?.sessionResetTimestamp
    ? formatResetTime(usage.sessionResetTimestamp)
    : usage?.sessionResetTime;

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
          id: activeProfile.id,
          baseUrl: activeProfile.baseUrl,
          createdAt: activeProfile.createdAt,
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

  // Helper function to format timestamp to readable date
  const formatDate = (timestamp?: number): string | undefined => {
    if (!timestamp) return undefined;
    return new Date(timestamp).toLocaleDateString();
  };

  // Helper function to truncate ID for display
  const truncateId = (id: string): string => {
    return id.slice(0, 8);
  };

  // Provider website URLs
  const providerWebsites: Record<string, string> = {
    anthrop: 'https://www.anthropic.com',
    zai: 'https://z.ai',
    zhipu: 'https://open.bigmodel.cn'
  };

  const getProviderWebsite = (provider: string): string | undefined => {
    if (provider === 'zai') return providerWebsites.zai;
    if (provider === 'zhipu') return providerWebsites.zhipu;
    if (provider === 'anthropic') return providerWebsites.anthropic;
    return undefined;
  };

  const isOAuth = authStatus.type === 'oauth';
  const Icon = isOAuth ? Lock : Key;

  return (
    <div className="flex items-center gap-2">
      {/* Usage Warning Badge (shown when usage >= 90%) */}
      {shouldShowUsageWarning && (
        <TooltipProvider delayDuration={200}>
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border bg-red-500/10 text-red-500 border-red-500/20">
                <AlertTriangle className="h-3.5 w-3.5 animate-pulse" />
              </div>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="text-xs max-w-xs">
              <div className="space-y-1">
                <div className="flex items-center justify-between gap-4">
                  <span className="text-muted-foreground font-medium">Usage Alert</span>
                  <span className="font-semibold text-red-500">{Math.round(warningBadgePercent)}%</span>
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
              {!isOAuth && (
                <>
                  <div className="h-px bg-border" />
                  <div className="space-y-1">
                    <div className="flex items-center justify-between gap-4">
                      <span className="text-muted-foreground text-[10px]">Profile</span>
                      <span className="font-medium text-[10px]">{authStatus.name}</span>
                    </div>
                    <div className="flex items-center justify-between gap-4">
                      <span className="text-muted-foreground text-[10px]">ID</span>
                      <span className="font-mono text-[10px] text-muted-foreground">{truncateId(authStatus.id)}</span>
                    </div>
                    {authStatus.createdAt && (
                      <div className="flex items-center justify-between gap-4">
                        <span className="text-muted-foreground text-[10px]">Created</span>
                        <span className="text-[10px] text-muted-foreground">{formatDate(authStatus.createdAt)}</span>
                      </div>
                    )}
                    {authStatus.baseUrl && (
                      <div className="pt-1">
                        <div className="text-[10px] text-muted-foreground mb-0.5">API Endpoint</div>
                        <div className="text-[10px] font-mono text-foreground break-all">{authStatus.baseUrl}</div>
                      </div>
                    )}
                    {getProviderWebsite(authStatus.provider) && (
                      <div className="pt-1">
                        <a
                          href={getProviderWebsite(authStatus.provider)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[10px] text-primary hover:underline flex items-center gap-1"
                        >
                          Visit {authStatus.providerLabel}
                          <svg className="h-2.5 w-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                          </svg>
                        </a>
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      {/* 5 Hour Usage Badge (shown when session usage >= 90%) */}
      {usage && !isLoadingUsage && usage.sessionPercent >= 90 && (
        <TooltipProvider delayDuration={200}>
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border bg-red-500/10 text-red-500 border-red-500/20 text-xs font-semibold">
                {Math.round(usage.sessionPercent)}%
              </div>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="text-xs max-w-xs">
              <div className="space-y-1">
                <div className="flex items-center justify-between gap-4">
                  <span className="text-muted-foreground font-medium">5 Hours Quota</span>
                  <span className="font-semibold text-red-500">{Math.round(usage.sessionPercent)}%</span>
                </div>
                {sessionResetTime && (
                  <>
                    <div className="h-px bg-border" />
                    <div className="text-[10px] text-muted-foreground">
                      {sessionResetTime}
                    </div>
                  </>
                )}
              </div>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )}
    </div>
  );
}

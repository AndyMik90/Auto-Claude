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
import { AlertTriangle, Key, Lock } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from './ui/tooltip';
import { useTranslation } from 'react-i18next';
import { useSettingsStore } from '../stores/settings-store';
import { detectProvider, getProviderLabel, getProviderBadgeColor, type ApiProvider } from '../../shared/utils/provider-detection';
import { formatTimeRemaining } from '../../shared/utils/format-time';
import type { ClaudeUsageSnapshot } from '../../shared/types/agent';

/**
 * Type-safe mapping from ApiProvider to translation keys
 */
const PROVIDER_TRANSLATION_KEYS: Readonly<Record<ApiProvider, string>> = {
  anthropic: 'common:usage.providerAnthropic',
  zai: 'common:usage.providerZai',
  zhipu: 'common:usage.providerZhipu',
  unknown: 'common:usage.providerUnknown'
} as const;

export function AuthStatusIndicator() {
  // Subscribe to profile state from settings store
  const { profiles, activeProfileId } = useSettingsStore();
  const { t } = useTranslation(['common']);

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
    }).catch(() => {
      // Handle errors (IPC failure, network issues, etc.)
      setIsLoadingUsage(false);
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
    ? (formatTimeRemaining(usage.sessionResetTimestamp, t) ?? usage?.sessionResetTime)
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

  // Helper function to truncate ID for display
  const truncateId = (id: string): string => {
    return id.slice(0, 8);
  };

  // Get localized provider label for display
  // Uses type-safe mapping with fallback to getProviderLabel for unknown providers
  const getLocalizedProviderLabel = (provider: string): string => {
    // Normalize to ApiProvider type
    const normalizedProvider = provider.toLowerCase() as ApiProvider;
    const translationKey = PROVIDER_TRANSLATION_KEYS[normalizedProvider];

    // Try to get translation, fallback to getProviderLabel if key doesn't exist or provider unknown
    if (translationKey && translationKey !== 'common:usage.providerUnknown') {
      const translated = t(translationKey);
      // If translation returns the key itself (not found), use getProviderLabel fallback
      if (translated !== translationKey) {
        return translated;
      }
    }

    // Fallback to getProviderLabel for unknown providers or missing translations
    return getProviderLabel(normalizedProvider);
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
                  <span className="text-muted-foreground font-medium">{t('common:usage.usageAlert')}</span>
                  <span className="font-semibold text-red-500">{Math.round(warningBadgePercent)}%</span>
                </div>
                <div className="h-px bg-border" />
                <div className="text-[10px] text-muted-foreground">
                  {t('common:usage.accountExceedsThreshold')}
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
              aria-label={t('common:usage.authenticationAriaLabel', { provider: getLocalizedProviderLabel(authStatus.provider) })}
            >
              <Icon className="h-3.5 w-3.5" />
              <span className="text-xs font-semibold">
                {getLocalizedProviderLabel(authStatus.provider)}
              </span>
            </button>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="text-xs max-w-xs">
            <div className="space-y-1">
              <div className="flex items-center justify-between gap-4">
                <span className="text-muted-foreground font-medium">{t('common:usage.authentication')}</span>
                <span className="font-semibold">{isOAuth ? t('common:usage.oauth') : t('common:usage.apiProfile')}</span>
              </div>
              <div className="flex items-center justify-between gap-4">
                <span className="text-muted-foreground font-medium">{t('common:usage.provider')}</span>
                <span className="font-semibold">{getLocalizedProviderLabel(authStatus.provider)}</span>
              </div>
              {!isOAuth && (
                <>
                  <div className="h-px bg-border" />
                  <div className="space-y-1">
                    <div className="flex items-center justify-between gap-4">
                      <span className="text-muted-foreground text-[10px]">{t('common:usage.profile')}</span>
                      <span className="font-medium text-[10px]">{authStatus.name}</span>
                    </div>
                    <div className="flex items-center justify-between gap-4">
                      <span className="text-muted-foreground text-[10px]">{t('common:usage.id')}</span>
                      <span className="font-mono text-[10px] text-muted-foreground">{truncateId(authStatus.id)}</span>
                    </div>
                    {authStatus.baseUrl && (
                      <div className="pt-1">
                        <div className="text-[10px] text-muted-foreground mb-0.5">{t('common:usage.apiEndpoint')}</div>
                        <div className="text-[10px] font-mono text-foreground break-all">{authStatus.baseUrl}</div>
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
                  <span className="text-muted-foreground font-medium">{usage.usageWindows?.sessionWindowLabel || t('common:usage.sessionQuota')}</span>
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

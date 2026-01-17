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
 */

import { useMemo } from 'react';
import { Key, Lock, Cloud } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from './ui/tooltip';
import { useSettingsStore } from '../stores/settings-store';
import { detectProvider, getProviderLabel, getProviderBadgeColor } from '../../shared/utils/provider-detection';

export function AuthStatusIndicator() {
  // Subscribe to profile state from settings store
  const { profiles, activeProfileId } = useSettingsStore();

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
  );
}

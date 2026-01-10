import { useState, useEffect, useCallback } from 'react';
import { useSettingsStore } from '../../../stores/settings-store';

export function useIdeationAuth() {
  const [hasToken, setHasToken] = useState<boolean | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const activeProfileId = useSettingsStore((state) => state.activeProfileId);
  const bedrockEnabled = useSettingsStore((state) => state.settings.bedrockEnabled);
  const bedrockConfig = useSettingsStore((state) => state.settings.bedrockConfig);

  const isBedrockConfigured = useCallback((): boolean => {
    if (!bedrockEnabled || !bedrockConfig) return false;
    if (!bedrockConfig.awsRegion) return false;
    
    const { authMethod, awsProfile, awsAccessKeyId, awsSecretAccessKey, awsBearerTokenBedrock } = bedrockConfig;
    if (authMethod === 'sso_profile' && awsProfile) return true;
    if (authMethod === 'access_keys' && awsAccessKeyId && awsSecretAccessKey) return true;
    if (authMethod === 'api_key' && awsBearerTokenBedrock) return true;
    return false;
  }, [bedrockEnabled, bedrockConfig]);

  const checkAuth = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      if (isBedrockConfigured()) {
        setHasToken(true);
        return;
      }

      const sourceTokenResult = await window.electronAPI.checkSourceToken();
      const hasSourceOAuthToken = sourceTokenResult.success && sourceTokenResult.data?.hasToken;

      let hasAPIProfile = false;
      if (activeProfileId && activeProfileId !== '') {
        hasAPIProfile = true;
      } else {
        try {
          const profilesResult = await window.electronAPI.getAPIProfiles();
          hasAPIProfile = Boolean(
            profilesResult.success &&
            profilesResult.data?.activeProfileId &&
            profilesResult.data.activeProfileId !== ''
          );
        } catch {
          hasAPIProfile = false;
        }
      }

      setHasToken(Boolean(hasSourceOAuthToken || hasAPIProfile));
    } catch (err) {
      setHasToken(false);
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsLoading(false);
    }
  }, [activeProfileId, isBedrockConfigured]);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  return { hasToken, isLoading, error, checkAuth };
}

/**
 * Unit tests for useIdeationAuth hook
 * Tests combined authentication logic from source OAuth token and API profiles
 *
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';

import '../../../../lib/browser-mock';
import { useIdeationAuth } from '../useIdeationAuth';
import { useSettingsStore } from '../../../../stores/settings-store';

const mockCheckSourceToken = vi.fn();
const mockGetApiProfiles = vi.fn();

const createProfile = (id: string, name: string) => ({
  id,
  name,
  baseUrl: 'https://api.anthropic.com',
  apiKey: `sk-ant-${id}`,
  createdAt: Date.now(),
  updatedAt: Date.now()
});

const setupSourceToken = (hasToken: boolean) => {
  mockCheckSourceToken.mockResolvedValue({
    success: true,
    data: { hasToken, ...(hasToken && { sourcePath: '/mock/auto-claude' }) }
  });
};

const setupStoreState = (state: {
  activeProfileId?: string | null;
  profiles?: ReturnType<typeof createProfile>[];
  bedrockEnabled?: boolean;
  bedrockConfig?: {
    authMethod: 'sso_profile' | 'access_keys' | 'api_key';
    awsRegion: string;
    awsProfile?: string;
    awsAccessKeyId?: string;
    awsSecretAccessKey?: string;
    awsBearerTokenBedrock?: string;
  };
}) => {
  const storeState: Record<string, unknown> = {
    profiles: state.profiles ?? [],
    activeProfileId: state.activeProfileId ?? null
  };
  
  if (state.bedrockEnabled !== undefined || state.bedrockConfig) {
    storeState.settings = {
      bedrockEnabled: state.bedrockEnabled,
      bedrockConfig: state.bedrockConfig
    };
  }
  
  useSettingsStore.setState(storeState as Partial<typeof useSettingsStore.getState>);
};

const renderAndWait = async () => {
  const { result } = renderHook(() => useIdeationAuth());
  await waitFor(() => {
    expect(result.current.isLoading).toBe(false);
  });
  return result;
};

describe('useIdeationAuth', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    useSettingsStore.setState({
      profiles: [],
      activeProfileId: null,
      profilesLoading: false,
      profilesError: null,
      isTestingConnection: false,
      testConnectionResult: null
    } as Partial<typeof useSettingsStore.getState>);

    if (window.electronAPI) {
      window.electronAPI.checkSourceToken = mockCheckSourceToken;
      window.electronAPI.getAPIProfiles = mockGetApiProfiles;
    }

    setupSourceToken(true);

    mockGetApiProfiles.mockResolvedValue({
      success: true,
      data: { profiles: [], activeProfileId: null, version: 1 }
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('initial state and loading', () => {
    it('should start with loading state', () => {
      const { result } = renderHook(() => useIdeationAuth());
      expect(result.current.isLoading).toBe(true);
      expect(result.current.hasToken).toBe(null);
      expect(result.current.error).toBe(null);
    });

    it('should complete loading after check', async () => {
      const result = await renderAndWait();
      expect(result.current.hasToken).toBe(true);
    });

    it('should provide checkAuth function', () => {
      const { result } = renderHook(() => useIdeationAuth());
      expect(typeof result.current.checkAuth).toBe('function');
    });
  });

  describe('source OAuth token authentication', () => {
    it('should return hasToken true when source OAuth token exists', async () => {
      setupSourceToken(true);
      setupStoreState({ activeProfileId: null });

      const result = await renderAndWait();

      expect(result.current.hasToken).toBe(true);
      expect(mockCheckSourceToken).toHaveBeenCalled();
    });

    it('should return hasToken false when source OAuth token does not exist', async () => {
      setupSourceToken(false);
      setupStoreState({ activeProfileId: null });

      const result = await renderAndWait();

      expect(result.current.hasToken).toBe(false);
    });

    it('should handle checkSourceToken API returning success: false gracefully', async () => {
      mockCheckSourceToken.mockResolvedValue({
        success: false,
        error: 'Failed to check source token'
      });
      setupStoreState({ activeProfileId: null });

      const result = await renderAndWait();

      expect(result.current.hasToken).toBe(false);
      expect(result.current.error).toBe(null);
    });

    it('should handle checkSourceToken exception', async () => {
      mockCheckSourceToken.mockRejectedValue(new Error('Network error'));
      setupStoreState({ activeProfileId: null });

      const result = await renderAndWait();

      expect(result.current.hasToken).toBe(false);
      expect(result.current.error).toBe('Network error');
    });
  });

  describe('API profile authentication', () => {
    it('should return hasToken true when API profile is active', async () => {
      setupSourceToken(false);
      setupStoreState({
        profiles: [createProfile('profile-1', 'Custom API')],
        activeProfileId: 'profile-1'
      });

      const result = await renderAndWait();

      expect(result.current.hasToken).toBe(true);
    });

    it('should fall back to IPC profiles when store activeProfileId is missing', async () => {
      setupSourceToken(false);
      mockGetApiProfiles.mockResolvedValue({
        success: true,
        data: {
          profiles: [createProfile('profile-1', 'Custom API')],
          activeProfileId: 'profile-1',
          version: 1
        }
      });
      setupStoreState({ activeProfileId: null });

      const result = await renderAndWait();

      expect(mockGetApiProfiles).toHaveBeenCalled();
      expect(result.current.hasToken).toBe(true);
    });

    it('should not call IPC profiles when store activeProfileId is set', async () => {
      setupSourceToken(false);
      setupStoreState({ activeProfileId: 'profile-1' });

      const result = await renderAndWait();

      expect(mockGetApiProfiles).not.toHaveBeenCalled();
      expect(result.current.hasToken).toBe(true);
    });

    it('should return hasToken false when no API profile is active', async () => {
      setupSourceToken(false);
      setupStoreState({
        profiles: [createProfile('profile-1', 'Custom API')],
        activeProfileId: null
      });

      const result = await renderAndWait();

      expect(result.current.hasToken).toBe(false);
    });

    it('should return hasToken false when activeProfileId is empty string', async () => {
      setupSourceToken(false);
      setupStoreState({ profiles: [], activeProfileId: '' });

      const result = await renderAndWait();

      expect(result.current.hasToken).toBe(false);
    });
  });

  describe('combined authentication (source token OR API profile)', () => {
    it('should return hasToken true when both source token and API profile exist', async () => {
      setupSourceToken(true);
      setupStoreState({
        profiles: [createProfile('profile-1', 'Custom API')],
        activeProfileId: 'profile-1'
      });

      const result = await renderAndWait();

      expect(result.current.hasToken).toBe(true);
    });

    it('should return hasToken true when only source token exists (no API profile)', async () => {
      setupSourceToken(true);
      setupStoreState({ profiles: [], activeProfileId: null });

      const result = await renderAndWait();

      expect(result.current.hasToken).toBe(true);
    });

    it('should return hasToken true when only API profile exists (no source token)', async () => {
      setupSourceToken(false);
      setupStoreState({
        profiles: [createProfile('profile-1', 'Custom API')],
        activeProfileId: 'profile-1'
      });

      const result = await renderAndWait();

      expect(result.current.hasToken).toBe(true);
    });

    it('should return hasToken false when neither source token nor API profile exists', async () => {
      setupSourceToken(false);
      setupStoreState({ profiles: [], activeProfileId: null });

      const result = await renderAndWait();

      expect(result.current.hasToken).toBe(false);
    });
  });

  describe('profile switching and re-checking', () => {
    it('should re-check authentication when activeProfileId changes', async () => {
      setupSourceToken(false);
      setupStoreState({
        profiles: [createProfile('profile-1', 'Custom API')],
        activeProfileId: null
      });

      const { result } = renderHook(() => useIdeationAuth());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });
      expect(result.current.hasToken).toBe(false);

      act(() => {
        useSettingsStore.setState({ activeProfileId: 'profile-1' });
      });

      await waitFor(() => {
        expect(result.current.hasToken).toBe(true);
      });

      expect(mockCheckSourceToken).toHaveBeenCalled();
    });

    it('should re-check authentication when switching from API profile to none', async () => {
      setupSourceToken(false);
      setupStoreState({
        profiles: [createProfile('profile-1', 'Custom API')],
        activeProfileId: 'profile-1'
      });

      const { result } = renderHook(() => useIdeationAuth());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });
      expect(result.current.hasToken).toBe(true);

      act(() => {
        useSettingsStore.setState({ activeProfileId: null });
      });

      await waitFor(() => {
        expect(result.current.hasToken).toBe(false);
      });
    });
  });

  describe('manual checkAuth function', () => {
    it('should manually re-check authentication when checkAuth is called', async () => {
      setupSourceToken(false);
      setupStoreState({ profiles: [], activeProfileId: null });

      const { result } = renderHook(() => useIdeationAuth());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });
      expect(result.current.hasToken).toBe(false);

      act(() => {
        useSettingsStore.setState({
          profiles: [createProfile('profile-1', 'Custom API')],
          activeProfileId: 'profile-1'
        });
      });

      await act(async () => {
        await result.current.checkAuth();
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.hasToken).toBe(true);
    });

    it('should set loading state during manual checkAuth', async () => {
      mockCheckSourceToken.mockImplementation(
        () => new Promise(resolve => {
          setTimeout(() => resolve({ success: true, data: { hasToken: true } }), 100);
        })
      );
      setupStoreState({ profiles: [], activeProfileId: null });

      const { result } = renderHook(() => useIdeationAuth());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      act(() => {
        result.current.checkAuth();
      });

      expect(result.current.isLoading).toBe(true);

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });
    });

    it('should clear error on successful manual re-check', async () => {
      mockCheckSourceToken.mockRejectedValueOnce(new Error('Network error'));
      mockCheckSourceToken.mockResolvedValueOnce({ success: true, data: { hasToken: true } });
      setupStoreState({ profiles: [], activeProfileId: null });

      const { result } = renderHook(() => useIdeationAuth());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });
      expect(result.current.error).toBe('Network error');

      await act(async () => {
        await result.current.checkAuth();
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.error).toBe(null);
      expect(result.current.hasToken).toBe(true);
    });
  });

  describe('Bedrock authentication', () => {
    it('should return hasToken true when Bedrock is configured with SSO profile', async () => {
      setupStoreState({
        bedrockEnabled: true,
        bedrockConfig: {
          authMethod: 'sso_profile',
          awsRegion: 'us-east-1',
          awsProfile: 'my-sso-profile'
        }
      });

      const result = await renderAndWait();

      expect(result.current.hasToken).toBe(true);
      expect(mockCheckSourceToken).not.toHaveBeenCalled();
    });

    it('should return hasToken true when Bedrock is configured with access keys', async () => {
      setupStoreState({
        bedrockEnabled: true,
        bedrockConfig: {
          authMethod: 'access_keys',
          awsRegion: 'us-west-2',
          awsAccessKeyId: 'AKIAIOSFODNN7EXAMPLE',
          awsSecretAccessKey: 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY'
        }
      });

      const result = await renderAndWait();

      expect(result.current.hasToken).toBe(true);
      expect(mockCheckSourceToken).not.toHaveBeenCalled();
    });

    it('should return hasToken true when Bedrock is configured with API key', async () => {
      setupStoreState({
        bedrockEnabled: true,
        bedrockConfig: {
          authMethod: 'api_key',
          awsRegion: 'eu-west-1',
          awsBearerTokenBedrock: 'bedrock-bearer-token-example'
        }
      });

      const result = await renderAndWait();

      expect(result.current.hasToken).toBe(true);
      expect(mockCheckSourceToken).not.toHaveBeenCalled();
    });

    it('should fallback to OAuth check when Bedrock is enabled but missing region', async () => {
      setupSourceToken(true);
      setupStoreState({
        bedrockEnabled: true,
        bedrockConfig: {
          authMethod: 'sso_profile',
          awsRegion: '',
          awsProfile: 'my-sso-profile'
        }
      });

      const result = await renderAndWait();

      expect(result.current.hasToken).toBe(true);
      expect(mockCheckSourceToken).toHaveBeenCalled();
    });

    it('should fallback to OAuth check when bedrockEnabled is false', async () => {
      setupSourceToken(false);
      setupStoreState({
        bedrockEnabled: false,
        bedrockConfig: {
          authMethod: 'sso_profile',
          awsRegion: 'us-east-1',
          awsProfile: 'my-sso-profile'
        }
      });

      const result = await renderAndWait();

      expect(result.current.hasToken).toBe(false);
      expect(mockCheckSourceToken).toHaveBeenCalled();
    });

    it('should fallback to OAuth check when SSO profile auth method has no profile', async () => {
      setupSourceToken(true);
      setupStoreState({
        bedrockEnabled: true,
        bedrockConfig: {
          authMethod: 'sso_profile',
          awsRegion: 'us-east-1',
          awsProfile: ''
        }
      });

      const result = await renderAndWait();

      expect(result.current.hasToken).toBe(true);
      expect(mockCheckSourceToken).toHaveBeenCalled();
    });

    it('should fallback to OAuth check when access keys auth method has no keys', async () => {
      setupSourceToken(false);
      setupStoreState({
        bedrockEnabled: true,
        bedrockConfig: {
          authMethod: 'access_keys',
          awsRegion: 'us-east-1',
          awsAccessKeyId: '',
          awsSecretAccessKey: ''
        }
      });

      const result = await renderAndWait();

      expect(result.current.hasToken).toBe(false);
      expect(mockCheckSourceToken).toHaveBeenCalled();
    });
  });

  describe('edge cases', () => {
    it('should handle activeProfileId as null', async () => {
      setupSourceToken(true);
      setupStoreState({ profiles: [], activeProfileId: null });

      const result = await renderAndWait();

      expect(result.current.hasToken).toBe(true);
    });

    it('should handle unknown error type in catch block', async () => {
      mockCheckSourceToken.mockRejectedValue('string error');
      setupStoreState({ profiles: [], activeProfileId: null });

      const result = await renderAndWait();

      expect(result.current.hasToken).toBe(false);
      expect(result.current.error).toBe('Unknown error');
    });

    it('should handle profiles array with API profiles', async () => {
      setupSourceToken(false);
      setupStoreState({
        profiles: [
          createProfile('profile-1', 'API 1'),
          createProfile('profile-2', 'API 2')
        ],
        activeProfileId: 'profile-2'
      });

      const result = await renderAndWait();

      expect(result.current.hasToken).toBe(true);
    });
  });
});

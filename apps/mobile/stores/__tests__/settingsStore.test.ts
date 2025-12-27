/**
 * Settings Store Unit Tests
 * Tests settings management, secure storage, and persistence
 */

import { act } from '@testing-library/react-native';
import { useSettingsStore } from '../settingsStore';
import type {
  ThemeMode,
  NotificationType,
  ConnectionStatus,
} from '../../types';

// Mock AsyncStorage
jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    getItem: jest.fn(() => Promise.resolve(null)),
    setItem: jest.fn(() => Promise.resolve()),
    removeItem: jest.fn(() => Promise.resolve()),
    clear: jest.fn(() => Promise.resolve()),
    getAllKeys: jest.fn(() => Promise.resolve([])),
    multiGet: jest.fn(() => Promise.resolve([])),
    multiSet: jest.fn(() => Promise.resolve()),
  },
}));

// Mock expo-secure-store
const mockSecureStore: { [key: string]: string } = {};
jest.mock('expo-secure-store', () => ({
  setItemAsync: jest.fn((key: string, value: string) => {
    mockSecureStore[key] = value;
    return Promise.resolve();
  }),
  getItemAsync: jest.fn((key: string) => {
    return Promise.resolve(mockSecureStore[key] || null);
  }),
  deleteItemAsync: jest.fn((key: string) => {
    delete mockSecureStore[key];
    return Promise.resolve();
  }),
}));

describe('SettingsStore', () => {
  // Reset store and mocks before each test
  beforeEach(() => {
    // Clear secure store mock
    Object.keys(mockSecureStore).forEach((key) => delete mockSecureStore[key]);

    act(() => {
      useSettingsStore.getState().resetStore();
    });
  });

  describe('Initial State', () => {
    it('should have default settings on initialization', () => {
      const { settings } = useSettingsStore.getState();
      expect(settings).toBeDefined();
    });

    it('should have dark theme as default', () => {
      const { settings } = useSettingsStore.getState();
      expect(settings.display.themeMode).toBe('dark');
    });

    it('should have notifications enabled by default', () => {
      const { settings } = useSettingsStore.getState();
      expect(settings.notifications.enabled).toBe(true);
    });

    it('should not be configured initially', () => {
      const { settings } = useSettingsStore.getState();
      expect(settings.connection.isConfigured).toBe(false);
    });

    it('should not have completed onboarding initially', () => {
      const { settings } = useSettingsStore.getState();
      expect(settings.onboardingCompleted).toBe(false);
    });

    it('should have debug mode disabled initially', () => {
      const { settings } = useSettingsStore.getState();
      expect(settings.debugMode).toBe(false);
    });

    it('should not be loading initially', () => {
      const { isLoading } = useSettingsStore.getState();
      expect(isLoading).toBe(false);
    });

    it('should have no error initially', () => {
      const { error } = useSettingsStore.getState();
      expect(error).toBeNull();
    });
  });

  describe('updateSettings', () => {
    it('should update connection settings', () => {
      const { updateSettings } = useSettingsStore.getState();

      act(() => {
        updateSettings({
          connection: {
            serverUrl: 'http://localhost:8000',
            isConfigured: true,
          },
        });
      });

      const { settings } = useSettingsStore.getState();
      expect(settings.connection.serverUrl).toBe('http://localhost:8000');
      expect(settings.connection.isConfigured).toBe(true);
    });

    it('should update notification settings', () => {
      const { updateSettings } = useSettingsStore.getState();

      act(() => {
        updateSettings({
          notifications: {
            enabled: false,
            sound: false,
          },
        });
      });

      const { settings } = useSettingsStore.getState();
      expect(settings.notifications.enabled).toBe(false);
      expect(settings.notifications.sound).toBe(false);
    });

    it('should update display settings', () => {
      const { updateSettings } = useSettingsStore.getState();

      act(() => {
        updateSettings({
          display: {
            themeMode: 'light',
            fontSize: 'large',
          },
        });
      });

      const { settings } = useSettingsStore.getState();
      expect(settings.display.themeMode).toBe('light');
      expect(settings.display.fontSize).toBe('large');
    });

    it('should update security settings', () => {
      const { updateSettings } = useSettingsStore.getState();

      act(() => {
        updateSettings({
          security: {
            biometricEnabled: true,
            autoLockEnabled: true,
          },
        });
      });

      const { settings } = useSettingsStore.getState();
      expect(settings.security.biometricEnabled).toBe(true);
      expect(settings.security.autoLockEnabled).toBe(true);
    });

    it('should update debug mode', () => {
      const { updateSettings } = useSettingsStore.getState();

      act(() => {
        updateSettings({ debugMode: true });
      });

      const { settings } = useSettingsStore.getState();
      expect(settings.debugMode).toBe(true);
    });

    it('should update analytics enabled', () => {
      const { updateSettings } = useSettingsStore.getState();

      act(() => {
        updateSettings({ analyticsEnabled: true });
      });

      const { settings } = useSettingsStore.getState();
      expect(settings.analyticsEnabled).toBe(true);
    });

    it('should preserve other settings when updating', () => {
      const { updateSettings, settings: originalSettings } =
        useSettingsStore.getState();
      const originalTheme = originalSettings.display.themeMode;

      act(() => {
        updateSettings({
          notifications: { enabled: false },
        });
      });

      const { settings } = useSettingsStore.getState();
      expect(settings.display.themeMode).toBe(originalTheme);
    });
  });

  describe('updateConnectionSettings', () => {
    it('should update server URL', () => {
      const { updateConnectionSettings } = useSettingsStore.getState();

      act(() => {
        updateConnectionSettings({ serverUrl: 'http://api.example.com' });
      });

      const { settings } = useSettingsStore.getState();
      expect(settings.connection.serverUrl).toBe('http://api.example.com');
    });

    it('should update WebSocket URL', () => {
      const { updateConnectionSettings } = useSettingsStore.getState();

      act(() => {
        updateConnectionSettings({ websocketUrl: 'ws://api.example.com/ws' });
      });

      const { settings } = useSettingsStore.getState();
      expect(settings.connection.websocketUrl).toBe('ws://api.example.com/ws');
    });

    it('should update connection status', () => {
      const { updateConnectionSettings } = useSettingsStore.getState();

      act(() => {
        updateConnectionSettings({ connectionStatus: 'connected' });
      });

      const { settings } = useSettingsStore.getState();
      expect(settings.connection.connectionStatus).toBe('connected');
    });
  });

  describe('updateNotificationSettings', () => {
    it('should update notification enabled state', () => {
      const { updateNotificationSettings } = useSettingsStore.getState();

      act(() => {
        updateNotificationSettings({ enabled: false });
      });

      const { settings } = useSettingsStore.getState();
      expect(settings.notifications.enabled).toBe(false);
    });

    it('should update sound and vibration settings', () => {
      const { updateNotificationSettings } = useSettingsStore.getState();

      act(() => {
        updateNotificationSettings({
          sound: false,
          vibration: false,
        });
      });

      const { settings } = useSettingsStore.getState();
      expect(settings.notifications.sound).toBe(false);
      expect(settings.notifications.vibration).toBe(false);
    });

    it('should update quiet hours settings', () => {
      const { updateNotificationSettings } = useSettingsStore.getState();

      act(() => {
        updateNotificationSettings({
          quietHoursEnabled: true,
          quietHoursStart: '22:00',
          quietHoursEnd: '08:00',
        });
      });

      const { settings } = useSettingsStore.getState();
      expect(settings.notifications.quietHoursEnabled).toBe(true);
      expect(settings.notifications.quietHoursStart).toBe('22:00');
      expect(settings.notifications.quietHoursEnd).toBe('08:00');
    });
  });

  describe('toggleNotificationType', () => {
    it('should enable a notification type', () => {
      const { toggleNotificationType } = useSettingsStore.getState();

      act(() => {
        toggleNotificationType('task_started', true);
      });

      const { settings } = useSettingsStore.getState();
      expect(settings.notifications.types.task_started).toBe(true);
    });

    it('should disable a notification type', () => {
      const { toggleNotificationType } = useSettingsStore.getState();

      act(() => {
        toggleNotificationType('task_completed', false);
      });

      const { settings } = useSettingsStore.getState();
      expect(settings.notifications.types.task_completed).toBe(false);
    });

    it('should only affect the specified type', () => {
      const { toggleNotificationType, settings: originalSettings } =
        useSettingsStore.getState();
      const originalTaskFailed = originalSettings.notifications.types.task_failed;

      act(() => {
        toggleNotificationType('task_completed', false);
      });

      const { settings } = useSettingsStore.getState();
      expect(settings.notifications.types.task_failed).toBe(originalTaskFailed);
    });
  });

  describe('updateDisplaySettings', () => {
    it('should update compact mode', () => {
      const { updateDisplaySettings } = useSettingsStore.getState();

      act(() => {
        updateDisplaySettings({ compactMode: true });
      });

      const { settings } = useSettingsStore.getState();
      expect(settings.display.compactMode).toBe(true);
    });

    it('should update haptic feedback', () => {
      const { updateDisplaySettings } = useSettingsStore.getState();

      act(() => {
        updateDisplaySettings({ hapticFeedback: false });
      });

      const { settings } = useSettingsStore.getState();
      expect(settings.display.hapticFeedback).toBe(false);
    });

    it('should update badge count visibility', () => {
      const { updateDisplaySettings } = useSettingsStore.getState();

      act(() => {
        updateDisplaySettings({ showBadgeCount: false });
      });

      const { settings } = useSettingsStore.getState();
      expect(settings.display.showBadgeCount).toBe(false);
    });
  });

  describe('setThemeMode', () => {
    it('should set theme to light', () => {
      const { setThemeMode } = useSettingsStore.getState();

      act(() => {
        setThemeMode('light');
      });

      const { settings } = useSettingsStore.getState();
      expect(settings.display.themeMode).toBe('light');
    });

    it('should set theme to dark', () => {
      const { setThemeMode } = useSettingsStore.getState();

      act(() => {
        setThemeMode('light');
        setThemeMode('dark');
      });

      const { settings } = useSettingsStore.getState();
      expect(settings.display.themeMode).toBe('dark');
    });

    it('should set theme to system', () => {
      const { setThemeMode } = useSettingsStore.getState();

      act(() => {
        setThemeMode('system');
      });

      const { settings } = useSettingsStore.getState();
      expect(settings.display.themeMode).toBe('system');
    });
  });

  describe('setConnectionStatus', () => {
    it('should set connection status to connected', () => {
      const { setConnectionStatus } = useSettingsStore.getState();

      act(() => {
        setConnectionStatus('connected');
      });

      const { settings } = useSettingsStore.getState();
      expect(settings.connection.connectionStatus).toBe('connected');
    });

    it('should update lastConnectedAt when connected', () => {
      const { setConnectionStatus } = useSettingsStore.getState();

      act(() => {
        setConnectionStatus('connected');
      });

      const { settings } = useSettingsStore.getState();
      expect(settings.connection.lastConnectedAt).toBeDefined();
    });

    it('should set connection status to disconnected', () => {
      const { setConnectionStatus } = useSettingsStore.getState();

      act(() => {
        setConnectionStatus('disconnected');
      });

      const { settings } = useSettingsStore.getState();
      expect(settings.connection.connectionStatus).toBe('disconnected');
    });

    it('should set connection status to connecting', () => {
      const { setConnectionStatus } = useSettingsStore.getState();

      act(() => {
        setConnectionStatus('connecting');
      });

      const { settings } = useSettingsStore.getState();
      expect(settings.connection.connectionStatus).toBe('connecting');
    });

    it('should set connection status to error', () => {
      const { setConnectionStatus } = useSettingsStore.getState();

      act(() => {
        setConnectionStatus('error');
      });

      const { settings } = useSettingsStore.getState();
      expect(settings.connection.connectionStatus).toBe('error');
    });
  });

  describe('Secure Storage (API Key)', () => {
    it('should save API key securely', async () => {
      const { saveApiKey } = useSettingsStore.getState();

      let result;
      await act(async () => {
        result = await saveApiKey('test-api-key-123');
      });

      expect(result).toBe(true);
      expect(mockSecureStore['autoclaude-api-key']).toBe('test-api-key-123');
    });

    it('should update hasApiKey flag when saving', async () => {
      const { saveApiKey } = useSettingsStore.getState();

      await act(async () => {
        await saveApiKey('test-api-key');
      });

      const { settings } = useSettingsStore.getState();
      expect(settings.connection.hasApiKey).toBe(true);
    });

    it('should delete API key securely', async () => {
      const { saveApiKey, deleteApiKey } = useSettingsStore.getState();

      await act(async () => {
        await saveApiKey('test-api-key');
        await deleteApiKey();
      });

      expect(mockSecureStore['autoclaude-api-key']).toBeUndefined();
    });

    it('should update hasApiKey flag when deleting', async () => {
      const { saveApiKey, deleteApiKey } = useSettingsStore.getState();

      await act(async () => {
        await saveApiKey('test-api-key');
        await deleteApiKey();
      });

      const { settings } = useSettingsStore.getState();
      expect(settings.connection.hasApiKey).toBe(false);
    });

    it('should get API key from secure storage', async () => {
      const { saveApiKey, getApiKey } = useSettingsStore.getState();

      await act(async () => {
        await saveApiKey('my-secret-key');
      });

      let retrievedKey;
      await act(async () => {
        retrievedKey = await useSettingsStore.getState().getApiKey();
      });

      expect(retrievedKey).toBe('my-secret-key');
    });

    it('should return null for non-existent API key', async () => {
      const { getApiKey } = useSettingsStore.getState();

      let result;
      await act(async () => {
        result = await getApiKey();
      });

      expect(result).toBeNull();
    });

    it('should check if API key exists', async () => {
      const { saveApiKey, checkApiKeyExists } = useSettingsStore.getState();

      let existsBefore;
      await act(async () => {
        existsBefore = await checkApiKeyExists();
      });
      expect(existsBefore).toBe(false);

      await act(async () => {
        await saveApiKey('test-key');
      });

      let existsAfter;
      await act(async () => {
        existsAfter = await useSettingsStore.getState().checkApiKeyExists();
      });
      expect(existsAfter).toBe(true);
    });

    it('should update isConfigured when API key is saved and serverUrl exists', async () => {
      const { updateConnectionSettings, saveApiKey } = useSettingsStore.getState();

      act(() => {
        updateConnectionSettings({ serverUrl: 'http://localhost:8000' });
      });

      await act(async () => {
        await saveApiKey('test-key');
      });

      const { settings } = useSettingsStore.getState();
      expect(settings.connection.isConfigured).toBe(true);
    });

    it('should set isConfigured to false when API key is deleted', async () => {
      const { updateConnectionSettings, saveApiKey, deleteApiKey } =
        useSettingsStore.getState();

      act(() => {
        updateConnectionSettings({ serverUrl: 'http://localhost:8000' });
      });

      await act(async () => {
        await saveApiKey('test-key');
      });

      await act(async () => {
        await deleteApiKey();
      });

      const { settings } = useSettingsStore.getState();
      expect(settings.connection.isConfigured).toBe(false);
    });
  });

  describe('Onboarding', () => {
    it('should complete onboarding', () => {
      const { completeOnboarding } = useSettingsStore.getState();

      act(() => {
        completeOnboarding();
      });

      const { settings } = useSettingsStore.getState();
      expect(settings.onboardingCompleted).toBe(true);
    });

    it('should set firstLaunchAt when completing onboarding', () => {
      const { completeOnboarding } = useSettingsStore.getState();

      act(() => {
        completeOnboarding();
      });

      const { settings } = useSettingsStore.getState();
      expect(settings.firstLaunchAt).toBeDefined();
    });

    it('should not overwrite firstLaunchAt if already set', () => {
      const { completeOnboarding, resetOnboarding } = useSettingsStore.getState();

      act(() => {
        completeOnboarding();
      });

      const { settings: settingsAfterFirst } = useSettingsStore.getState();
      const firstLaunchAt = settingsAfterFirst.firstLaunchAt;

      act(() => {
        resetOnboarding();
        completeOnboarding();
      });

      const { settings: settingsAfterSecond } = useSettingsStore.getState();
      expect(settingsAfterSecond.firstLaunchAt).toBe(firstLaunchAt);
    });

    it('should reset onboarding', () => {
      const { completeOnboarding, resetOnboarding } = useSettingsStore.getState();

      act(() => {
        completeOnboarding();
        resetOnboarding();
      });

      const { settings } = useSettingsStore.getState();
      expect(settings.onboardingCompleted).toBe(false);
    });
  });

  describe('Debug and Analytics', () => {
    it('should toggle debug mode', () => {
      const { toggleDebugMode } = useSettingsStore.getState();

      act(() => {
        toggleDebugMode();
      });

      expect(useSettingsStore.getState().settings.debugMode).toBe(true);

      act(() => {
        toggleDebugMode();
      });

      expect(useSettingsStore.getState().settings.debugMode).toBe(false);
    });

    it('should toggle analytics', () => {
      const { toggleAnalytics } = useSettingsStore.getState();

      act(() => {
        toggleAnalytics();
      });

      expect(useSettingsStore.getState().settings.analyticsEnabled).toBe(true);

      act(() => {
        toggleAnalytics();
      });

      expect(useSettingsStore.getState().settings.analyticsEnabled).toBe(false);
    });
  });

  describe('Security Settings', () => {
    it('should update biometric settings', () => {
      const { updateSecuritySettings } = useSettingsStore.getState();

      act(() => {
        updateSecuritySettings({
          biometricEnabled: true,
          biometricType: 'fingerprint',
        });
      });

      const { settings } = useSettingsStore.getState();
      expect(settings.security.biometricEnabled).toBe(true);
      expect(settings.security.biometricType).toBe('fingerprint');
    });

    it('should update auto-lock settings', () => {
      const { updateSecuritySettings } = useSettingsStore.getState();

      act(() => {
        updateSecuritySettings({
          autoLockEnabled: true,
          autoLockTimeout: 10,
        });
      });

      const { settings } = useSettingsStore.getState();
      expect(settings.security.autoLockEnabled).toBe(true);
      expect(settings.security.autoLockTimeout).toBe(10);
    });

    it('should update requireAuthOnLaunch', () => {
      const { updateSecuritySettings } = useSettingsStore.getState();

      act(() => {
        updateSecuritySettings({ requireAuthOnLaunch: true });
      });

      const { settings } = useSettingsStore.getState();
      expect(settings.security.requireAuthOnLaunch).toBe(true);
    });
  });

  describe('Rate Limit Settings', () => {
    it('should update rate limit configuration', () => {
      const { updateRateLimitSettings } = useSettingsStore.getState();

      act(() => {
        updateRateLimitSettings({
          requestsPerMinute: 100,
          tokensPerMinute: 200000,
        });
      });

      const { settings } = useSettingsStore.getState();
      expect(settings.rateLimits.requestsPerMinute).toBe(100);
      expect(settings.rateLimits.tokensPerMinute).toBe(200000);
    });
  });

  describe('Sync Settings', () => {
    it('should update sync settings', () => {
      const { updateSyncSettings } = useSettingsStore.getState();

      act(() => {
        updateSyncSettings({
          autoSync: false,
          syncInterval: 60,
          syncOnWifiOnly: true,
        });
      });

      const { settings } = useSettingsStore.getState();
      expect(settings.sync.autoSync).toBe(false);
      expect(settings.sync.syncInterval).toBe(60);
      expect(settings.sync.syncOnWifiOnly).toBe(true);
    });
  });

  describe('Loading and Error States', () => {
    it('should set loading state', () => {
      const { setLoading } = useSettingsStore.getState();

      act(() => {
        setLoading(true);
      });
      expect(useSettingsStore.getState().isLoading).toBe(true);

      act(() => {
        setLoading(false);
      });
      expect(useSettingsStore.getState().isLoading).toBe(false);
    });

    it('should set error message', () => {
      const { setError } = useSettingsStore.getState();

      act(() => {
        setError('Settings failed to save');
      });
      expect(useSettingsStore.getState().error).toBe('Settings failed to save');

      act(() => {
        setError(null);
      });
      expect(useSettingsStore.getState().error).toBeNull();
    });
  });

  describe('Hydration', () => {
    it('should track hydration state', () => {
      const { setHydrated } = useSettingsStore.getState();

      act(() => {
        setHydrated(true);
      });

      expect(useSettingsStore.getState().isHydrated).toBe(true);
    });
  });

  describe('resetStore', () => {
    it('should reset store to initial state', () => {
      const {
        updateSettings,
        completeOnboarding,
        setLoading,
        setError,
        resetStore,
      } = useSettingsStore.getState();

      // Modify state
      act(() => {
        updateSettings({
          display: { themeMode: 'light' },
          debugMode: true,
        });
        completeOnboarding();
        setLoading(true);
        setError('Test error');
      });

      // Reset
      act(() => {
        resetStore();
      });

      const state = useSettingsStore.getState();
      expect(state.settings.display.themeMode).toBe('dark');
      expect(state.settings.debugMode).toBe(false);
      expect(state.settings.onboardingCompleted).toBe(false);
      expect(state.isLoading).toBe(false);
      expect(state.error).toBeNull();
    });
  });

  describe('resetToDefaults', () => {
    it('should reset settings to defaults', () => {
      const { updateSettings, resetToDefaults } = useSettingsStore.getState();

      act(() => {
        updateSettings({
          display: { themeMode: 'light', fontSize: 'large' },
          notifications: { enabled: false },
        });
        resetToDefaults();
      });

      const { settings } = useSettingsStore.getState();
      expect(settings.display.themeMode).toBe('dark');
      expect(settings.display.fontSize).toBe('medium');
      expect(settings.notifications.enabled).toBe(true);
    });

    it('should preserve firstLaunchAt when resetting', () => {
      const { completeOnboarding, resetToDefaults } = useSettingsStore.getState();

      act(() => {
        completeOnboarding();
      });

      const { settings: beforeReset } = useSettingsStore.getState();
      const firstLaunchAt = beforeReset.firstLaunchAt;

      act(() => {
        resetToDefaults();
      });

      const { settings: afterReset } = useSettingsStore.getState();
      expect(afterReset.firstLaunchAt).toBe(firstLaunchAt);
    });

    it('should preserve hasApiKey when resetting', async () => {
      const { saveApiKey, resetToDefaults } = useSettingsStore.getState();

      await act(async () => {
        await saveApiKey('test-key');
      });

      act(() => {
        resetToDefaults();
      });

      const { settings } = useSettingsStore.getState();
      expect(settings.connection.hasApiKey).toBe(true);
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty server URL', () => {
      const { updateConnectionSettings } = useSettingsStore.getState();

      act(() => {
        updateConnectionSettings({ serverUrl: '' });
      });

      const { settings } = useSettingsStore.getState();
      expect(settings.connection.serverUrl).toBe('');
    });

    it('should handle invalid auto-lock timeout gracefully', () => {
      const { updateSecuritySettings } = useSettingsStore.getState();

      act(() => {
        updateSecuritySettings({ autoLockTimeout: -1 });
      });

      const { settings } = useSettingsStore.getState();
      expect(settings.security.autoLockTimeout).toBe(-1);
    });

    it('should handle very large rate limits', () => {
      const { updateRateLimitSettings } = useSettingsStore.getState();

      act(() => {
        updateRateLimitSettings({
          requestsPerMinute: 1000000,
          tokensPerMinute: 100000000,
        });
      });

      const { settings } = useSettingsStore.getState();
      expect(settings.rateLimits.requestsPerMinute).toBe(1000000);
      expect(settings.rateLimits.tokensPerMinute).toBe(100000000);
    });

    it('should handle rapid setting updates', () => {
      const { setThemeMode } = useSettingsStore.getState();

      act(() => {
        for (let i = 0; i < 10; i++) {
          setThemeMode(i % 2 === 0 ? 'light' : 'dark');
        }
      });

      const { settings } = useSettingsStore.getState();
      // Should end on 'dark' (last iteration is i=9, 9%2=1, so 'dark')
      expect(settings.display.themeMode).toBe('dark');
    });
  });
});

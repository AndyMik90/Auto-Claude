/**
 * Settings Store
 * Zustand store for app settings and configuration
 * Uses persist middleware with AsyncStorage for general settings
 * Uses expo-secure-store for sensitive data (API key)
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import type {
  AppSettings,
  ConnectionSettings,
  NotificationSettings,
  DisplaySettings,
  SecuritySettings,
  RateLimitConfig,
  SyncSettings,
  SettingsUpdateInput,
  ThemeMode,
  NotificationType,
  ConnectionStatus,
} from '../types';
import {
  defaultNotificationSettings,
  defaultDisplaySettings,
  defaultSecuritySettings,
  defaultSyncSettings,
  defaultRateLimitConfig,
} from '../types';

/**
 * Secure storage key for API key
 */
const API_KEY_STORAGE_KEY = 'autoclaude-api-key';

/**
 * Get current timestamp in ISO format
 */
const now = (): string => new Date().toISOString();

/**
 * Default connection settings
 */
const defaultConnectionSettings: ConnectionSettings = {
  serverUrl: '',
  websocketUrl: undefined,
  isConfigured: false,
  connectionStatus: 'disconnected',
  hasApiKey: false,
};

/**
 * Default app settings
 */
const defaultAppSettings: AppSettings = {
  connection: defaultConnectionSettings,
  notifications: defaultNotificationSettings,
  display: defaultDisplaySettings,
  security: defaultSecuritySettings,
  rateLimits: defaultRateLimitConfig,
  sync: defaultSyncSettings,
  onboardingCompleted: false,
  debugMode: false,
  analyticsEnabled: false,
};

/**
 * Settings Store State Interface
 */
interface SettingsState {
  /** App settings */
  settings: AppSettings;

  /** Loading state for async operations */
  isLoading: boolean;

  /** Error message if any */
  error: string | null;

  /** Whether the store has been hydrated from storage */
  isHydrated: boolean;
}

/**
 * Settings Store Actions Interface
 */
interface SettingsActions {
  /** Update settings with partial updates */
  updateSettings: (updates: SettingsUpdateInput) => void;

  /** Update connection settings */
  updateConnectionSettings: (updates: Partial<ConnectionSettings>) => void;

  /** Update notification settings */
  updateNotificationSettings: (updates: Partial<NotificationSettings>) => void;

  /** Update display settings */
  updateDisplaySettings: (updates: Partial<DisplaySettings>) => void;

  /** Update security settings */
  updateSecuritySettings: (updates: Partial<SecuritySettings>) => void;

  /** Update rate limit settings */
  updateRateLimitSettings: (updates: Partial<RateLimitConfig>) => void;

  /** Update sync settings */
  updateSyncSettings: (updates: Partial<SyncSettings>) => void;

  /** Toggle notification type */
  toggleNotificationType: (type: NotificationType, enabled: boolean) => void;

  /** Set theme mode */
  setThemeMode: (mode: ThemeMode) => void;

  /** Set connection status */
  setConnectionStatus: (status: ConnectionStatus) => void;

  /** Save API key to secure storage */
  saveApiKey: (apiKey: string) => Promise<boolean>;

  /** Delete API key from secure storage */
  deleteApiKey: () => Promise<boolean>;

  /** Get API key from secure storage */
  getApiKey: () => Promise<string | null>;

  /** Check if API key exists */
  checkApiKeyExists: () => Promise<boolean>;

  /** Complete onboarding */
  completeOnboarding: () => void;

  /** Reset onboarding (for testing) */
  resetOnboarding: () => void;

  /** Toggle debug mode */
  toggleDebugMode: () => void;

  /** Toggle analytics */
  toggleAnalytics: () => void;

  /** Set loading state */
  setLoading: (loading: boolean) => void;

  /** Set error message */
  setError: (error: string | null) => void;

  /** Set hydrated state */
  setHydrated: (hydrated: boolean) => void;

  /** Reset store to initial state */
  resetStore: () => void;

  /** Reset all settings to defaults */
  resetToDefaults: () => void;
}

/**
 * Combined Settings Store Type
 */
type SettingsStore = SettingsState & SettingsActions;

/**
 * Initial state for the store
 */
const initialState: SettingsState = {
  settings: defaultAppSettings,
  isLoading: false,
  error: null,
  isHydrated: false,
};

/**
 * Settings Store
 * Zustand store with persist middleware for AsyncStorage persistence
 * API key is stored separately in expo-secure-store
 */
export const useSettingsStore = create<SettingsStore>()(
  persist(
    (set, get) => ({
      // Initial state
      ...initialState,

      // Actions
      updateSettings: (updates: SettingsUpdateInput): void => {
        set((state) => ({
          settings: {
            ...state.settings,
            ...(updates.connection && {
              connection: { ...state.settings.connection, ...updates.connection },
            }),
            ...(updates.notifications && {
              notifications: { ...state.settings.notifications, ...updates.notifications },
            }),
            ...(updates.display && {
              display: { ...state.settings.display, ...updates.display },
            }),
            ...(updates.security && {
              security: { ...state.settings.security, ...updates.security },
            }),
            ...(updates.rateLimits && {
              rateLimits: { ...state.settings.rateLimits, ...updates.rateLimits },
            }),
            ...(updates.sync && {
              sync: { ...state.settings.sync, ...updates.sync },
            }),
            ...(updates.debugMode !== undefined && { debugMode: updates.debugMode }),
            ...(updates.analyticsEnabled !== undefined && {
              analyticsEnabled: updates.analyticsEnabled,
            }),
          },
        }));
      },

      updateConnectionSettings: (updates: Partial<ConnectionSettings>): void => {
        set((state) => ({
          settings: {
            ...state.settings,
            connection: { ...state.settings.connection, ...updates },
          },
        }));
      },

      updateNotificationSettings: (updates: Partial<NotificationSettings>): void => {
        set((state) => ({
          settings: {
            ...state.settings,
            notifications: { ...state.settings.notifications, ...updates },
          },
        }));
      },

      updateDisplaySettings: (updates: Partial<DisplaySettings>): void => {
        set((state) => ({
          settings: {
            ...state.settings,
            display: { ...state.settings.display, ...updates },
          },
        }));
      },

      updateSecuritySettings: (updates: Partial<SecuritySettings>): void => {
        set((state) => ({
          settings: {
            ...state.settings,
            security: { ...state.settings.security, ...updates },
          },
        }));
      },

      updateRateLimitSettings: (updates: Partial<RateLimitConfig>): void => {
        set((state) => ({
          settings: {
            ...state.settings,
            rateLimits: { ...state.settings.rateLimits, ...updates },
          },
        }));
      },

      updateSyncSettings: (updates: Partial<SyncSettings>): void => {
        set((state) => ({
          settings: {
            ...state.settings,
            sync: { ...state.settings.sync, ...updates },
          },
        }));
      },

      toggleNotificationType: (type: NotificationType, enabled: boolean): void => {
        set((state) => ({
          settings: {
            ...state.settings,
            notifications: {
              ...state.settings.notifications,
              types: {
                ...state.settings.notifications.types,
                [type]: enabled,
              },
            },
          },
        }));
      },

      setThemeMode: (mode: ThemeMode): void => {
        set((state) => ({
          settings: {
            ...state.settings,
            display: { ...state.settings.display, themeMode: mode },
          },
        }));
      },

      setConnectionStatus: (status: ConnectionStatus): void => {
        const updates: Partial<ConnectionSettings> = {
          connectionStatus: status,
        };

        // Update last connected time when successfully connected
        if (status === 'connected') {
          updates.lastConnectedAt = now();
        }

        set((state) => ({
          settings: {
            ...state.settings,
            connection: { ...state.settings.connection, ...updates },
          },
        }));
      },

      saveApiKey: async (apiKey: string): Promise<boolean> => {
        try {
          get().setLoading(true);
          get().setError(null);

          await SecureStore.setItemAsync(API_KEY_STORAGE_KEY, apiKey);

          // Update hasApiKey flag in settings
          set((state) => ({
            settings: {
              ...state.settings,
              connection: {
                ...state.settings.connection,
                hasApiKey: true,
                isConfigured: !!state.settings.connection.serverUrl,
              },
            },
          }));

          get().setLoading(false);
          return true;
        } catch (error) {
          const errorMessage =
            error instanceof Error ? error.message : 'Failed to save API key';
          get().setError(errorMessage);
          get().setLoading(false);
          return false;
        }
      },

      deleteApiKey: async (): Promise<boolean> => {
        try {
          get().setLoading(true);
          get().setError(null);

          await SecureStore.deleteItemAsync(API_KEY_STORAGE_KEY);

          // Update hasApiKey flag in settings
          set((state) => ({
            settings: {
              ...state.settings,
              connection: {
                ...state.settings.connection,
                hasApiKey: false,
                isConfigured: false,
              },
            },
          }));

          get().setLoading(false);
          return true;
        } catch (error) {
          const errorMessage =
            error instanceof Error ? error.message : 'Failed to delete API key';
          get().setError(errorMessage);
          get().setLoading(false);
          return false;
        }
      },

      getApiKey: async (): Promise<string | null> => {
        try {
          return await SecureStore.getItemAsync(API_KEY_STORAGE_KEY);
        } catch (error) {
          const errorMessage =
            error instanceof Error ? error.message : 'Failed to retrieve API key';
          get().setError(errorMessage);
          return null;
        }
      },

      checkApiKeyExists: async (): Promise<boolean> => {
        try {
          const apiKey = await SecureStore.getItemAsync(API_KEY_STORAGE_KEY);
          const hasKey = !!apiKey;

          // Update hasApiKey flag if it doesn't match
          const currentHasKey = get().settings.connection.hasApiKey;
          if (currentHasKey !== hasKey) {
            set((state) => ({
              settings: {
                ...state.settings,
                connection: {
                  ...state.settings.connection,
                  hasApiKey: hasKey,
                },
              },
            }));
          }

          return hasKey;
        } catch {
          return false;
        }
      },

      completeOnboarding: (): void => {
        set((state) => ({
          settings: {
            ...state.settings,
            onboardingCompleted: true,
            firstLaunchAt: state.settings.firstLaunchAt || now(),
          },
        }));
      },

      resetOnboarding: (): void => {
        set((state) => ({
          settings: {
            ...state.settings,
            onboardingCompleted: false,
          },
        }));
      },

      toggleDebugMode: (): void => {
        set((state) => ({
          settings: {
            ...state.settings,
            debugMode: !state.settings.debugMode,
          },
        }));
      },

      toggleAnalytics: (): void => {
        set((state) => ({
          settings: {
            ...state.settings,
            analyticsEnabled: !state.settings.analyticsEnabled,
          },
        }));
      },

      setLoading: (loading: boolean): void => {
        set({ isLoading: loading });
      },

      setError: (error: string | null): void => {
        set({ error });
      },

      setHydrated: (hydrated: boolean): void => {
        set({ isHydrated: hydrated });
      },

      resetStore: (): void => {
        set(initialState);
      },

      resetToDefaults: (): void => {
        set((state) => ({
          settings: {
            ...defaultAppSettings,
            // Preserve certain values
            firstLaunchAt: state.settings.firstLaunchAt,
            connection: {
              ...defaultConnectionSettings,
              hasApiKey: state.settings.connection.hasApiKey, // Keep API key reference
            },
          },
        }));
      },
    }),
    {
      name: 'autoclaude-settings-storage',
      storage: createJSONStorage(() => AsyncStorage),
      // Only persist settings, not UI state
      partialize: (state) => ({
        settings: state.settings,
      }),
      onRehydrateStorage: () => (state) => {
        // Mark as hydrated after rehydration
        if (state) {
          state.setHydrated(true);
        }
      },
    }
  )
);

/**
 * Selector hooks for common use cases
 */

/** Get theme mode */
export const useThemeMode = (): ThemeMode => {
  return useSettingsStore((state) => state.settings.display.themeMode);
};

/** Get connection settings */
export const useConnectionSettings = (): ConnectionSettings => {
  return useSettingsStore((state) => state.settings.connection);
};

/** Get notification settings */
export const useNotificationSettings = (): NotificationSettings => {
  return useSettingsStore((state) => state.settings.notifications);
};

/** Get display settings */
export const useDisplaySettings = (): DisplaySettings => {
  return useSettingsStore((state) => state.settings.display);
};

/** Get security settings */
export const useSecuritySettings = (): SecuritySettings => {
  return useSettingsStore((state) => state.settings.security);
};

/** Check if connection is configured */
export const useIsConnectionConfigured = (): boolean => {
  return useSettingsStore((state) => state.settings.connection.isConfigured);
};

/** Check if onboarding is completed */
export const useIsOnboardingCompleted = (): boolean => {
  return useSettingsStore((state) => state.settings.onboardingCompleted);
};

/** Get connection status */
export const useConnectionStatus = (): ConnectionStatus => {
  return useSettingsStore((state) => state.settings.connection.connectionStatus);
};

/** Check if notifications are enabled */
export const useNotificationsEnabled = (): boolean => {
  return useSettingsStore((state) => state.settings.notifications.enabled);
};

/** Check if biometric auth is enabled */
export const useBiometricEnabled = (): boolean => {
  return useSettingsStore((state) => state.settings.security.biometricEnabled);
};

/** Get sync settings */
export const useSyncSettings = (): SyncSettings => {
  return useSettingsStore((state) => state.settings.sync);
};

/** Check if debug mode is enabled */
export const useDebugMode = (): boolean => {
  return useSettingsStore((state) => state.settings.debugMode);
};

/** Get all settings */
export const useAppSettings = (): AppSettings => {
  return useSettingsStore((state) => state.settings);
};

/** Check if store has been hydrated */
export const useIsSettingsHydrated = (): boolean => {
  return useSettingsStore((state) => state.isHydrated);
};

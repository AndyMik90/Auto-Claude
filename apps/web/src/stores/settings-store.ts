import { create } from 'zustand';
import type {
  AppSettings,
  APIProfile,
  ProfileFormData,
  TestConnectionResult,
  DiscoverModelsResult,
  ModelInfo,
  ApiResponse
} from '../types';
import { ipc } from '../lib/ipc-abstraction';

const DEFAULT_APP_SETTINGS: AppSettings = {
  theme: 'system',
  fontSize: 14,
  autoSave: true,
  notifications: true,
  activeProfileId: null
};

interface SettingsState {
  settings: AppSettings;
  isLoading: boolean;
  error: string | null;

  // API Profile state
  profiles: APIProfile[];
  activeProfileId: string | null;
  profilesLoading: boolean;
  profilesError: string | null;

  // Test connection state
  isTestingConnection: boolean;
  testConnectionResult: TestConnectionResult | null;

  // Model discovery state
  modelsLoading: boolean;
  modelsError: string | null;
  discoveredModels: Map<string, ModelInfo[]>; // Cache key -> models mapping

  // Actions
  setSettings: (settings: AppSettings) => void;
  updateSettings: (updates: Partial<AppSettings>) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;

  // Profile actions
  setProfiles: (profiles: APIProfile[], activeProfileId: string | null) => void;
  setProfilesLoading: (loading: boolean) => void;
  setProfilesError: (error: string | null) => void;
  saveProfile: (profile: ProfileFormData) => Promise<boolean>;
  updateProfile: (profile: APIProfile) => Promise<boolean>;
  deleteProfile: (profileId: string) => Promise<boolean>;
  setActiveProfile: (profileId: string | null) => Promise<boolean>;
  testConnection: (baseUrl: string, apiKey: string, signal?: AbortSignal) => Promise<TestConnectionResult | null>;
  discoverModels: (baseUrl: string, apiKey: string, signal?: AbortSignal) => Promise<ModelInfo[] | null>;
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  settings: DEFAULT_APP_SETTINGS as AppSettings,
  isLoading: true, // Start as true since we load settings on app init
  error: null,

  // API Profile state
  profiles: [],
  activeProfileId: null,
  profilesLoading: false,
  profilesError: null,

  // Test connection state
  isTestingConnection: false,
  testConnectionResult: null,

  // Model discovery state
  modelsLoading: false,
  modelsError: null,
  discoveredModels: new Map<string, ModelInfo[]>(),

  setSettings: (settings) => set({ settings }),

  updateSettings: (updates) =>
    set((state) => ({
      settings: { ...state.settings, ...updates }
    })),

  setLoading: (isLoading) => set({ isLoading }),

  setError: (error) => set({ error }),

  // Profile actions
  setProfiles: (profiles, activeProfileId) => set({ profiles, activeProfileId }),

  setProfilesLoading: (profilesLoading) => set({ profilesLoading }),

  setProfilesError: (profilesError) => set({ profilesError }),

  saveProfile: async (profile: ProfileFormData): Promise<boolean> => {
    set({ profilesLoading: true, profilesError: null });

    return new Promise((resolve) => {
      // Send save request via IPC
      ipc.send('save-api-profile', profile);

      // Listen for response
      const handleResponse = (result: ApiResponse<APIProfile>) => {
        if (result.success && result.data) {
          // Re-fetch profiles from backend to get authoritative state
          ipc.send('get-api-profiles');

          const handleProfilesResponse = (profilesResult: ApiResponse<{ profiles: APIProfile[]; activeProfileId: string | null }>) => {
            if (profilesResult.success && profilesResult.data) {
              set({
                profiles: profilesResult.data.profiles,
                activeProfileId: profilesResult.data.activeProfileId,
                profilesLoading: false
              });
            } else {
              // Fallback: add profile locally but don't assume activeProfileId
              set((state) => ({
                profiles: [...state.profiles, result.data!],
                profilesLoading: false
              }));
            }
            ipc.off('api-profiles-loaded', handleProfilesResponse);
            resolve(true);
          };

          ipc.once('api-profiles-loaded', handleProfilesResponse);

          // Timeout fallback
          setTimeout(() => {
            ipc.off('api-profiles-loaded', handleProfilesResponse);
            set((state) => ({
              profiles: [...state.profiles, result.data!],
              profilesLoading: false
            }));
            resolve(true);
          }, 5000);
        } else {
          set({
            profilesError: result.error || 'Failed to save profile',
            profilesLoading: false
          });
          resolve(false);
        }
        ipc.off('api-profile-saved', handleResponse);
      };

      ipc.once('api-profile-saved', handleResponse);

      // Timeout after 10 seconds
      setTimeout(() => {
        ipc.off('api-profile-saved', handleResponse);
        set({
          profilesError: 'Request timeout',
          profilesLoading: false
        });
        resolve(false);
      }, 10000);
    });
  },

  updateProfile: async (profile: APIProfile): Promise<boolean> => {
    set({ profilesLoading: true, profilesError: null });

    return new Promise((resolve) => {
      // Send update request via IPC
      ipc.send('update-api-profile', profile);

      // Listen for response
      const handleResponse = (result: ApiResponse<APIProfile>) => {
        if (result.success && result.data) {
          set((state) => ({
            profiles: state.profiles.map((p) => (p.id === result.data!.id ? result.data! : p)),
            profilesLoading: false
          }));
          resolve(true);
        } else {
          set({
            profilesError: result.error || 'Failed to update profile',
            profilesLoading: false
          });
          resolve(false);
        }
        ipc.off('api-profile-updated', handleResponse);
      };

      ipc.once('api-profile-updated', handleResponse);

      // Timeout after 10 seconds
      setTimeout(() => {
        ipc.off('api-profile-updated', handleResponse);
        set({
          profilesError: 'Request timeout',
          profilesLoading: false
        });
        resolve(false);
      }, 10000);
    });
  },

  deleteProfile: async (profileId: string): Promise<boolean> => {
    set({ profilesLoading: true, profilesError: null });

    return new Promise((resolve) => {
      // Send delete request via IPC
      ipc.send('delete-api-profile', profileId);

      // Listen for response
      const handleResponse = (result: ApiResponse) => {
        if (result.success) {
          set((state) => ({
            profiles: state.profiles.filter((p) => p.id !== profileId),
            activeProfileId: state.activeProfileId === profileId ? null : state.activeProfileId,
            profilesLoading: false
          }));
          resolve(true);
        } else {
          set({
            profilesError: result.error || 'Failed to delete profile',
            profilesLoading: false
          });
          resolve(false);
        }
        ipc.off('api-profile-deleted', handleResponse);
      };

      ipc.once('api-profile-deleted', handleResponse);

      // Timeout after 10 seconds
      setTimeout(() => {
        ipc.off('api-profile-deleted', handleResponse);
        set({
          profilesError: 'Request timeout',
          profilesLoading: false
        });
        resolve(false);
      }, 10000);
    });
  },

  setActiveProfile: async (profileId: string | null): Promise<boolean> => {
    set({ profilesLoading: true, profilesError: null });

    return new Promise((resolve) => {
      // Send set active request via IPC
      ipc.send('set-active-api-profile', profileId);

      // Listen for response
      const handleResponse = (result: ApiResponse) => {
        if (result.success) {
          set({ activeProfileId: profileId, profilesLoading: false });
          resolve(true);
        } else {
          set({
            profilesError: result.error || 'Failed to set active profile',
            profilesLoading: false
          });
          resolve(false);
        }
        ipc.off('active-api-profile-set', handleResponse);
      };

      ipc.once('active-api-profile-set', handleResponse);

      // Timeout after 10 seconds
      setTimeout(() => {
        ipc.off('active-api-profile-set', handleResponse);
        set({
          profilesError: 'Request timeout',
          profilesLoading: false
        });
        resolve(false);
      }, 10000);
    });
  },

  testConnection: async (
    baseUrl: string,
    apiKey: string,
    signal?: AbortSignal
  ): Promise<TestConnectionResult | null> => {
    set({ isTestingConnection: true });

    return new Promise((resolve) => {
      // Send test connection request via IPC
      ipc.send('test-api-connection', { baseUrl, apiKey });

      // Listen for response
      const handleResponse = (result: TestConnectionResult) => {
        set({
          isTestingConnection: false,
          testConnectionResult: result
        });
        resolve(result);
        ipc.off('api-connection-tested', handleResponse);
      };

      ipc.once('api-connection-tested', handleResponse);

      // Handle abort signal
      if (signal) {
        signal.addEventListener('abort', () => {
          ipc.off('api-connection-tested', handleResponse);
          set({ isTestingConnection: false });
          resolve(null);
        });
      }

      // Timeout after 30 seconds
      setTimeout(() => {
        if (get().isTestingConnection) {
          ipc.off('api-connection-tested', handleResponse);
          const timeoutResult: TestConnectionResult = {
            success: false,
            message: 'Connection test timeout'
          };
          set({
            isTestingConnection: false,
            testConnectionResult: timeoutResult
          });
          resolve(timeoutResult);
        }
      }, 30000);
    });
  },

  discoverModels: async (
    baseUrl: string,
    apiKey: string,
    signal?: AbortSignal
  ): Promise<ModelInfo[] | null> => {
    set({ modelsLoading: true, modelsError: null });

    return new Promise((resolve) => {
      // Generate cache key
      const cacheKey = `${baseUrl}:${apiKey.substring(0, 8)}`;

      // Check cache first
      const cached = get().discoveredModels.get(cacheKey);
      if (cached) {
        set({ modelsLoading: false });
        resolve(cached);
        return;
      }

      // Send discover models request via IPC
      ipc.send('discover-api-models', { baseUrl, apiKey });

      // Listen for response
      const handleResponse = (result: DiscoverModelsResult) => {
        if (result.success && result.models) {
          // Update cache
          set((state) => {
            const newCache = new Map(state.discoveredModels);
            newCache.set(cacheKey, result.models!);
            return {
              modelsLoading: false,
              modelsError: null,
              discoveredModels: newCache
            };
          });
          resolve(result.models);
        } else {
          set({
            modelsLoading: false,
            modelsError: result.error || 'Failed to discover models'
          });
          resolve(null);
        }
        ipc.off('api-models-discovered', handleResponse);
      };

      ipc.once('api-models-discovered', handleResponse);

      // Handle abort signal
      if (signal) {
        signal.addEventListener('abort', () => {
          ipc.off('api-models-discovered', handleResponse);
          set({ modelsLoading: false });
          resolve(null);
        });
      }

      // Timeout after 30 seconds
      setTimeout(() => {
        if (get().modelsLoading) {
          ipc.off('api-models-discovered', handleResponse);
          set({
            modelsLoading: false,
            modelsError: 'Request timeout'
          });
          resolve(null);
        }
      }, 30000);
    });
  }
}));

// Set up IPC listeners for settings updates from backend
if (typeof window !== 'undefined') {
  ipc.on('settings-loaded', (data: AppSettings) => {
    useSettingsStore.getState().setSettings(data);
    useSettingsStore.getState().setLoading(false);
  });

  ipc.on('settings-updated', (data: AppSettings) => {
    useSettingsStore.getState().setSettings(data);
  });

  ipc.on('api-profiles-loaded', (data: { profiles: APIProfile[]; activeProfileId: string | null }) => {
    useSettingsStore.getState().setProfiles(data.profiles, data.activeProfileId);
  });
}

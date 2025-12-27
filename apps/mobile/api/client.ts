/**
 * TanStack Query Client Configuration for React Native
 *
 * This module configures the QueryClient with React Native-specific
 * integrations for focus and online state management.
 *
 * Key Features:
 * - AppState integration for focus detection (refetch-on-focus)
 * - NetInfo integration for online/offline detection
 * - Optimized default options for mobile
 */

import { QueryClient, focusManager, onlineManager } from '@tanstack/react-query';
import { AppState, Platform } from 'react-native';
import type { AppStateStatus } from 'react-native';
import NetInfo from '@react-native-community/netinfo';

/**
 * Configure focus detection for React Native
 *
 * Maps AppState changes to TanStack Query's focusManager.
 * This enables refetch-on-focus functionality on mobile devices.
 *
 * When the app comes to the foreground (AppState === 'active'),
 * focusManager will trigger refetches for stale queries.
 */
function configureFocusManager(): void {
  // Only set up AppState listener on native platforms
  if (Platform.OS !== 'web') {
    // Handle initial state
    focusManager.setFocused(AppState.currentState === 'active');

    // Subscribe to AppState changes
    const subscription = AppState.addEventListener(
      'change',
      (status: AppStateStatus) => {
        // Only consider 'active' as focused
        // 'inactive' (iOS) and 'background' are not focused
        focusManager.setFocused(status === 'active');
      }
    );

    // Note: We don't clean up this subscription as it should persist
    // for the entire app lifecycle. The QueryClient is typically
    // created once and never destroyed.
  }
}

/**
 * Configure online status detection for React Native
 *
 * Integrates NetInfo with TanStack Query's onlineManager.
 * This enables:
 * - Pausing queries when offline
 * - Resuming/retrying queries when back online
 * - Optimistic mutations with offline queue
 */
function configureOnlineManager(): void {
  // Set up NetInfo listener for network state changes
  onlineManager.setEventListener((setOnline) => {
    // Subscribe to network state changes
    const unsubscribe = NetInfo.addEventListener((state) => {
      // Consider connected if isConnected is true
      // Use !! to ensure boolean value (handle null/undefined)
      const isOnline = !!state.isConnected;
      setOnline(isOnline);
    });

    // Return cleanup function (called when listener is replaced)
    return unsubscribe;
  });
}

/**
 * Default query options optimized for mobile
 *
 * These settings balance between data freshness and battery/network usage:
 * - staleTime: 60s - Reasonable cache duration for mobile
 * - gcTime: 5 minutes - Keep unused data for quick navigation
 * - retry: 2 - Retry failed requests twice (mobile networks can be flaky)
 * - refetchOnReconnect: true - Refetch when coming back online
 * - refetchOnWindowFocus: false - Handled by focusManager instead
 */
const defaultQueryOptions = {
  queries: {
    // Consider data stale after 1 minute
    staleTime: 60 * 1000,
    // Keep unused data in cache for 5 minutes
    gcTime: 5 * 60 * 1000,
    // Retry failed requests up to 2 times
    retry: 2,
    // Exponential backoff for retries
    retryDelay: (attemptIndex: number) => Math.min(1000 * 2 ** attemptIndex, 30000),
    // Refetch when connection is restored
    refetchOnReconnect: true,
    // Don't use window focus events (we use AppState instead)
    refetchOnWindowFocus: false,
    // Refetch on mount if data is stale
    refetchOnMount: true,
    // Network mode: always try to fetch, use cache when offline
    networkMode: 'offlineFirst' as const,
  },
  mutations: {
    // Retry mutations once on failure
    retry: 1,
    // Network mode for mutations
    networkMode: 'offlineFirst' as const,
  },
};

/**
 * Create and configure the QueryClient instance
 *
 * This is the main QueryClient used throughout the app.
 * It's configured with React Native-specific integrations
 * and optimized default options.
 */
function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: defaultQueryOptions,
  });
}

// Initialize focus and online managers
// These must be called before the QueryClient is used
configureFocusManager();
configureOnlineManager();

/**
 * The main QueryClient instance for the app
 *
 * Usage:
 * Import this in the root layout and wrap your app:
 *
 * ```tsx
 * import { queryClient } from '@/api/client';
 * import { QueryClientProvider } from '@tanstack/react-query';
 *
 * export default function RootLayout() {
 *   return (
 *     <QueryClientProvider client={queryClient}>
 *       <App />
 *     </QueryClientProvider>
 *   );
 * }
 * ```
 */
export const queryClient = createQueryClient();

/**
 * Re-export commonly used TanStack Query utilities
 * for convenience when making API calls
 */
export { focusManager, onlineManager } from '@tanstack/react-query';

/**
 * Utility to check if the app is currently online
 * Uses TanStack Query's onlineManager state
 */
export const isOnline = (): boolean => {
  return onlineManager.isOnline();
};

/**
 * Utility to manually trigger focus (e.g., after deep link navigation)
 */
export const triggerFocus = (): void => {
  focusManager.setFocused(true);
};

/**
 * Utility to manually trigger online state
 * Useful for testing or forcing refetches
 */
export const triggerOnline = (): void => {
  onlineManager.setOnline(true);
};

/**
 * Get current focus state
 */
export const isFocused = (): boolean | undefined => {
  return focusManager.isFocused();
};

/**
 * API Base URL configuration
 * Will be used by API hooks when connecting to the backend (Phase 6)
 */
export const API_ENDPOINTS = {
  // Base URLs (to be configured via settings)
  REST_BASE: '', // e.g., 'http://localhost:8000/api'
  WS_BASE: '', // e.g., 'ws://localhost:8000/ws'

  // REST endpoints (relative paths)
  TASKS: '/tasks',
  PROJECTS: '/projects',
  CHAT: '/chat',
  GITHUB: '/github',
  TERMINAL: '/terminal',
  SETTINGS: '/settings',
} as const;

/**
 * Default headers for API requests
 */
export const getDefaultHeaders = (): Record<string, string> => {
  return {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  };
};

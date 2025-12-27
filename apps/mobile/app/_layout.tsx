/**
 * Root Layout
 * Wraps the entire app with necessary providers:
 * - QueryClientProvider (TanStack Query)
 * - PaperProvider (React Native Paper)
 * - ErrorBoundary (Error handling)
 *
 * Sets up:
 * - Push notifications (expo-notifications)
 * - WebSocket notification handling
 * - Offline indicator
 *
 * Note: The queryClient is imported from api/client.ts which sets up
 * AppState and NetInfo integrations for proper React Native support.
 */

import React, { useEffect, useRef, useCallback } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { QueryClientProvider } from '@tanstack/react-query';
import { PaperProvider, Portal } from 'react-native-paper';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { StyleSheet, Platform, View } from 'react-native';

import { darkTheme, colors } from '../theme';
import { queryClient } from '../api/client';
import { ErrorBoundary, OfflineBanner } from '../components';
import {
  initializeNotifications,
  setupNotificationListeners,
  requestNotificationPermissions,
  registerForPushNotifications,
  handleWebSocketNotification,
} from '../utils/notifications';
import type { NotificationType } from '../types';

/**
 * Stack screen options with dark theme styling
 */
const screenOptions = {
  headerStyle: {
    backgroundColor: colors.background.secondary,
  },
  headerTintColor: colors.text.primary,
  headerTitleStyle: {
    fontWeight: 'bold' as const,
  },
  contentStyle: {
    backgroundColor: colors.background.primary,
  },
  headerShadowVisible: false,
  animation: 'default' as const,
};

/**
 * WebSocket notification event payload
 */
interface WebSocketNotificationPayload {
  type: NotificationType;
  title: string;
  body: string;
  data?: Record<string, unknown>;
}

export default function RootLayout() {
  const notificationCleanupRef = useRef<(() => void) | null>(null);

  /**
   * Handle WebSocket notification events
   * This is triggered when a notification message is received via WebSocket
   */
  const handleWebSocketNotificationEvent = useCallback((event: Event) => {
    const customEvent = event as CustomEvent<WebSocketNotificationPayload>;
    const payload = customEvent.detail;

    if (payload) {
      handleWebSocketNotification(payload);
    }
  }, []);

  /**
   * Initialize notifications on app mount
   */
  useEffect(() => {
    const setupNotifications = async (): Promise<void> => {
      // Initialize notification channels and check for launch notification
      await initializeNotifications();

      // Set up notification listeners (received and response)
      notificationCleanupRef.current = setupNotificationListeners();

      // Request notification permissions
      const hasPermission = await requestNotificationPermissions();

      if (hasPermission) {
        // Register for push notifications (mock token in development)
        await registerForPushNotifications();
      }
    };

    setupNotifications();

    // Listen for WebSocket notification events
    // The WebSocket client emits these when notification messages are received
    if (Platform.OS !== 'web' && typeof window !== 'undefined') {
      window.addEventListener(
        'autoclaude:notification',
        handleWebSocketNotificationEvent
      );
    }

    // Cleanup on unmount
    return () => {
      if (notificationCleanupRef.current) {
        notificationCleanupRef.current();
      }

      if (Platform.OS !== 'web' && typeof window !== 'undefined') {
        window.removeEventListener(
          'autoclaude:notification',
          handleWebSocketNotificationEvent
        );
      }
    };
  }, [handleWebSocketNotificationEvent]);

  /**
   * Handle error boundary errors
   * Could be extended to send to error reporting service
   */
  const handleError = useCallback((error: Error, errorInfo: React.ErrorInfo) => {
    // Log error in development
    if (__DEV__) {
      // eslint-disable-next-line no-console
      console.error('App Error:', error.message);
    }
    // In production, this could send to an error reporting service
  }, []);

  return (
    <GestureHandlerRootView style={styles.container}>
      <QueryClientProvider client={queryClient}>
        <PaperProvider theme={darkTheme}>
          <ErrorBoundary name="App" onError={handleError}>
            <StatusBar style="light" />
            {/* Offline indicator banner */}
            <OfflineBanner testID="offline-banner" />
            <Stack screenOptions={screenOptions}>
            {/* Tab Navigator - hides header since tabs have their own */}
            <Stack.Screen
              name="(tabs)"
              options={{ headerShown: false }}
            />

            {/* Task Detail Screen */}
            <Stack.Screen
              name="task/[id]"
              options={{
                title: 'Task Details',
                presentation: 'card',
              }}
            />

            {/* Task Creation Wizard */}
            <Stack.Screen
              name="task/create"
              options={{
                title: 'Create Task',
                presentation: 'modal',
              }}
            />

            {/* Project Detail Screen */}
            <Stack.Screen
              name="project/[id]"
              options={{
                title: 'Project Details',
                presentation: 'card',
              }}
            />

            {/* GitHub Issue Detail */}
            <Stack.Screen
              name="github/issue/[id]"
              options={{
                title: 'Issue Details',
                presentation: 'card',
              }}
            />

            {/* GitHub PR Detail */}
            <Stack.Screen
              name="github/pr/[id]"
              options={{
                title: 'Pull Request',
                presentation: 'card',
              }}
            />

            {/* Terminal List */}
            <Stack.Screen
              name="terminal/index"
              options={{
                title: 'Terminals',
                presentation: 'card',
              }}
            />

            {/* Terminal Detail */}
            <Stack.Screen
              name="terminal/[id]"
              options={{
                title: 'Terminal',
                presentation: 'card',
              }}
            />

            {/* Roadmap Screen */}
            <Stack.Screen
              name="roadmap"
              options={{
                title: 'Roadmap',
                presentation: 'card',
              }}
            />

            {/* Ideation Screen */}
            <Stack.Screen
              name="ideation"
              options={{
                title: 'Ideas',
                presentation: 'card',
              }}
            />

            {/* Context Screen */}
            <Stack.Screen
              name="context"
              options={{
                title: 'Context',
                presentation: 'card',
              }}
            />

            {/* Onboarding Wizard - Full screen, no header */}
            <Stack.Screen
              name="onboarding"
              options={{
                headerShown: false,
                presentation: 'fullScreenModal',
              }}
            />

            {/* Index redirect screen */}
            <Stack.Screen
              name="index"
              options={{
                headerShown: false,
              }}
            />
          </Stack>
          </ErrorBoundary>
        </PaperProvider>
      </QueryClientProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.primary,
  },
});

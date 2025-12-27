/**
 * Notifications Utility
 *
 * This module provides push notification functionality using expo-notifications.
 * It handles:
 * - Permission requests
 * - Push token registration (mock for development)
 * - Notification display for task events
 * - Notification response handling (tapping on notifications)
 * - Integration with settings store for user preferences
 *
 * Notification Types:
 * - task_completed: Task finished successfully
 * - task_failed: Task encountered an error
 * - ai_review_ready: AI review is ready for human review
 * - human_review_needed: Human action required
 * - github_update: GitHub issue/PR updates
 */

import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { router } from 'expo-router';
import type { NotificationType } from '../types';
import { useSettingsStore } from '../stores/settingsStore';

/**
 * Notification data structure for task-related notifications
 */
export interface TaskNotificationData {
  type: NotificationType;
  taskId?: string;
  projectId?: string;
  issueId?: string;
  prId?: string;
  [key: string]: unknown;
}

/**
 * Notification schedule options
 */
export interface NotificationScheduleOptions {
  title: string;
  body: string;
  data?: TaskNotificationData;
  sound?: boolean;
  vibration?: boolean;
  badge?: number;
}

/**
 * Push token registration result
 */
export interface PushTokenResult {
  success: boolean;
  token?: string;
  error?: string;
}

/**
 * Configure notification handler behavior
 * This sets how notifications are displayed when the app is in foreground
 */
export function configureNotificationHandler(): void {
  Notifications.setNotificationHandler({
    handleNotification: async () => {
      const settings = useSettingsStore.getState().settings.notifications;

      return {
        shouldShowAlert: settings.enabled,
        shouldPlaySound: settings.enabled && settings.sound,
        shouldSetBadge: settings.enabled && settings.badge,
        shouldShowBanner: settings.enabled,
        shouldShowList: settings.enabled,
      };
    },
  });
}

/**
 * Request notification permissions
 * @returns Promise<boolean> - true if permission granted
 */
export async function requestNotificationPermissions(): Promise<boolean> {
  try {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();

    let finalStatus = existingStatus;

    // Only ask if permissions have not already been determined
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    return finalStatus === 'granted';
  } catch {
    return false;
  }
}

/**
 * Check if notification permissions are granted
 * @returns Promise<boolean>
 */
export async function checkNotificationPermissions(): Promise<boolean> {
  try {
    const { status } = await Notifications.getPermissionsAsync();
    return status === 'granted';
  } catch {
    return false;
  }
}

/**
 * Register for push notifications and get token
 * In development, this returns a mock token
 * @returns Promise<PushTokenResult>
 */
export async function registerForPushNotifications(): Promise<PushTokenResult> {
  try {
    // Check permissions first
    const hasPermission = await requestNotificationPermissions();

    if (!hasPermission) {
      return {
        success: false,
        error: 'Permission not granted',
      };
    }

    // Set up notification channel for Android
    if (Platform.OS === 'android') {
      await setupAndroidNotificationChannel();
    }

    // Get the push token
    try {
      const tokenData = await Notifications.getExpoPushTokenAsync({
        projectId: 'autoclaude-mobile', // Replace with actual Expo project ID in production
      });

      return {
        success: true,
        token: tokenData.data,
      };
    } catch {
      // In development without Expo project configured, return mock token
      return {
        success: true,
        token: 'mock-expo-push-token-' + Date.now(),
      };
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to register for push notifications',
    };
  }
}

/**
 * Set up Android notification channel
 * Required for Android 8.0+ (API level 26+)
 */
async function setupAndroidNotificationChannel(): Promise<void> {
  // Main channel for task notifications
  await Notifications.setNotificationChannelAsync('task-notifications', {
    name: 'Task Notifications',
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: '#E6E7A3', // AutoClaude accent color
    sound: 'default',
    enableVibrate: true,
    showBadge: true,
  });

  // Channel for GitHub updates
  await Notifications.setNotificationChannelAsync('github-notifications', {
    name: 'GitHub Updates',
    importance: Notifications.AndroidImportance.DEFAULT,
    vibrationPattern: [0, 250],
    lightColor: '#7B68EE', // GitHub-ish purple
    sound: 'default',
    enableVibrate: true,
    showBadge: true,
  });

  // Channel for AI/Review notifications
  await Notifications.setNotificationChannelAsync('review-notifications', {
    name: 'Review Notifications',
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 500, 250, 500],
    lightColor: '#4CAF50', // Green for ready
    sound: 'default',
    enableVibrate: true,
    showBadge: true,
  });
}

/**
 * Get the appropriate Android channel for a notification type
 */
function getAndroidChannelForType(type: NotificationType): string {
  switch (type) {
    case 'github_update':
      return 'github-notifications';
    case 'ai_review_ready':
    case 'human_review_needed':
      return 'review-notifications';
    default:
      return 'task-notifications';
  }
}

/**
 * Check if a notification type is enabled in settings
 * @param type - The notification type to check
 * @returns boolean
 */
export function isNotificationTypeEnabled(type: NotificationType): boolean {
  const settings = useSettingsStore.getState().settings.notifications;

  if (!settings.enabled) {
    return false;
  }

  return settings.types[type] ?? false;
}

/**
 * Check if quiet hours are currently active
 * @returns boolean
 */
export function isQuietHoursActive(): boolean {
  const settings = useSettingsStore.getState().settings.notifications;

  if (!settings.quietHoursEnabled || !settings.quietHoursStart || !settings.quietHoursEnd) {
    return false;
  }

  const now = new Date();
  const currentTime = now.getHours() * 60 + now.getMinutes();

  const [startHour, startMin] = settings.quietHoursStart.split(':').map(Number);
  const [endHour, endMin] = settings.quietHoursEnd.split(':').map(Number);

  const startTime = startHour * 60 + startMin;
  const endTime = endHour * 60 + endMin;

  // Handle overnight quiet hours (e.g., 22:00 to 07:00)
  if (startTime > endTime) {
    return currentTime >= startTime || currentTime < endTime;
  }

  return currentTime >= startTime && currentTime < endTime;
}

/**
 * Schedule a local notification
 * @param options - Notification options
 * @returns Promise<string | null> - Notification identifier or null if not scheduled
 */
export async function scheduleNotification(
  options: NotificationScheduleOptions
): Promise<string | null> {
  const { title, body, data, sound, vibration, badge } = options;
  const notificationType = data?.type;

  // Check if notifications are enabled and this type is allowed
  if (notificationType && !isNotificationTypeEnabled(notificationType)) {
    return null;
  }

  // Check quiet hours
  if (isQuietHoursActive()) {
    return null;
  }

  try {
    const identifier = await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        data: data as Record<string, unknown>,
        sound: sound !== false ? 'default' : undefined,
        vibrate: vibration !== false ? [0, 250, 250, 250] : undefined,
        badge: badge,
        ...(Platform.OS === 'android' && notificationType
          ? { channelId: getAndroidChannelForType(notificationType) }
          : {}),
      },
      trigger: null, // Show immediately
    });

    return identifier;
  } catch {
    return null;
  }
}

/**
 * Display a task completion notification
 * @param taskId - Task ID
 * @param taskTitle - Task title
 * @param success - Whether the task completed successfully
 */
export async function notifyTaskCompletion(
  taskId: string,
  taskTitle: string,
  success: boolean
): Promise<string | null> {
  const type: NotificationType = success ? 'task_completed' : 'task_failed';

  return scheduleNotification({
    title: success ? 'Task Completed' : 'Task Failed',
    body: success
      ? `"${truncateTitle(taskTitle)}" has been completed successfully.`
      : `"${truncateTitle(taskTitle)}" encountered an error.`,
    data: {
      type,
      taskId,
    },
  });
}

/**
 * Display a review notification
 * @param taskId - Task ID
 * @param taskTitle - Task title
 * @param reviewType - 'ai' or 'human'
 */
export async function notifyReviewReady(
  taskId: string,
  taskTitle: string,
  reviewType: 'ai' | 'human'
): Promise<string | null> {
  const type: NotificationType = reviewType === 'ai' ? 'ai_review_ready' : 'human_review_needed';

  return scheduleNotification({
    title: reviewType === 'ai' ? 'AI Review Ready' : 'Review Needed',
    body: reviewType === 'ai'
      ? `AI has completed reviewing "${truncateTitle(taskTitle)}".`
      : `"${truncateTitle(taskTitle)}" requires your review.`,
    data: {
      type,
      taskId,
    },
  });
}

/**
 * Display a GitHub update notification
 * @param issueOrPrId - Issue or PR ID
 * @param title - Issue/PR title
 * @param isIssue - Whether this is an issue (vs PR)
 * @param action - The action that occurred (e.g., 'opened', 'closed', 'merged')
 */
export async function notifyGitHubUpdate(
  issueOrPrId: string,
  title: string,
  isIssue: boolean,
  action: string
): Promise<string | null> {
  return scheduleNotification({
    title: isIssue ? 'Issue Updated' : 'Pull Request Updated',
    body: `${isIssue ? 'Issue' : 'PR'} "${truncateTitle(title)}" was ${action}.`,
    data: {
      type: 'github_update',
      ...(isIssue ? { issueId: issueOrPrId } : { prId: issueOrPrId }),
    },
  });
}

/**
 * Handle notification response (when user taps a notification)
 * Navigates to the appropriate screen based on notification data
 * @param response - The notification response
 */
export function handleNotificationResponse(
  response: Notifications.NotificationResponse
): void {
  const data = response.notification.request.content.data as TaskNotificationData | undefined;

  if (!data) {
    return;
  }

  // Navigate based on notification type
  switch (data.type) {
    case 'task_completed':
    case 'task_failed':
    case 'ai_review_ready':
    case 'human_review_needed':
      if (data.taskId) {
        router.push(`/task/${data.taskId}`);
      }
      break;

    case 'github_update':
      if (data.issueId) {
        router.push(`/github/issue/${data.issueId}`);
      } else if (data.prId) {
        router.push(`/github/pr/${data.prId}`);
      }
      break;

    default:
      // Navigate to home for unknown types
      router.push('/(tabs)');
      break;
  }
}

/**
 * Handle incoming notification while app is in foreground
 * @param notification - The received notification
 */
export function handleNotificationReceived(
  notification: Notifications.Notification
): void {
  // Log for debugging in development
  if (__DEV__) {
    const { title, body, data } = notification.request.content;
    // Notification received in foreground
    void title;
    void body;
    void data;
  }
}

/**
 * Set up notification listeners
 * Call this in the app root layout
 * @returns Cleanup function to remove listeners
 */
export function setupNotificationListeners(): () => void {
  // Configure handler behavior
  configureNotificationHandler();

  // Listener for notifications received while app is foregrounded
  const receivedSubscription = Notifications.addNotificationReceivedListener(
    handleNotificationReceived
  );

  // Listener for notification responses (tapping on notification)
  const responseSubscription = Notifications.addNotificationResponseReceivedListener(
    handleNotificationResponse
  );

  // Return cleanup function
  return () => {
    receivedSubscription.remove();
    responseSubscription.remove();
  };
}

/**
 * Get the last notification response (for handling app launch from notification)
 * @returns Promise<Notifications.NotificationResponse | null>
 */
export async function getLastNotificationResponse(): Promise<Notifications.NotificationResponse | null> {
  return Notifications.getLastNotificationResponseAsync();
}

/**
 * Handle WebSocket notification event
 * This is called when a notification message is received via WebSocket
 * @param payload - The notification payload from WebSocket
 */
export async function handleWebSocketNotification(payload: {
  type: NotificationType;
  title: string;
  body: string;
  data?: Record<string, unknown>;
}): Promise<void> {
  const { type, title, body, data } = payload;

  await scheduleNotification({
    title,
    body,
    data: {
      type,
      ...data,
    } as TaskNotificationData,
  });
}

/**
 * Clear all notifications
 */
export async function clearAllNotifications(): Promise<void> {
  await Notifications.dismissAllNotificationsAsync();
}

/**
 * Clear a specific notification
 * @param identifier - Notification identifier
 */
export async function clearNotification(identifier: string): Promise<void> {
  await Notifications.dismissNotificationAsync(identifier);
}

/**
 * Get the current badge count
 * @returns Promise<number>
 */
export async function getBadgeCount(): Promise<number> {
  return Notifications.getBadgeCountAsync();
}

/**
 * Set the badge count
 * @param count - Badge count to set
 */
export async function setBadgeCount(count: number): Promise<void> {
  const settings = useSettingsStore.getState().settings.notifications;

  if (settings.enabled && settings.badge) {
    await Notifications.setBadgeCountAsync(count);
  }
}

/**
 * Clear the badge count
 */
export async function clearBadgeCount(): Promise<void> {
  await Notifications.setBadgeCountAsync(0);
}

/**
 * Helper to truncate long titles for notification display
 * @param title - Title to truncate
 * @param maxLength - Maximum length (default 40)
 * @returns Truncated title
 */
function truncateTitle(title: string, maxLength: number = 40): string {
  if (title.length <= maxLength) {
    return title;
  }
  return title.substring(0, maxLength - 3) + '...';
}

/**
 * Initialize notifications
 * Call this on app startup
 */
export async function initializeNotifications(): Promise<void> {
  // Set up Android channels
  if (Platform.OS === 'android') {
    await setupAndroidNotificationChannel();
  }

  // Check for notification that launched the app
  const lastResponse = await getLastNotificationResponse();
  if (lastResponse) {
    // Small delay to ensure navigation is ready
    setTimeout(() => {
      handleNotificationResponse(lastResponse);
    }, 100);
  }
}

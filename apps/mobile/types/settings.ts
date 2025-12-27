/**
 * Settings Types
 * Defines types for app settings and configuration
 */

/**
 * Theme mode
 */
export type ThemeMode = 'dark' | 'light' | 'system';

/**
 * Notification type
 */
export type NotificationType =
  | 'task_completed'
  | 'task_failed'
  | 'task_started'
  | 'ai_review_ready'
  | 'human_review_needed'
  | 'chat_response'
  | 'github_update';

/**
 * Connection status
 */
export type ConnectionStatus =
  | 'connected'
  | 'connecting'
  | 'disconnected'
  | 'error';

/**
 * Connection settings for server communication
 */
export interface ConnectionSettings {
  serverUrl: string;
  websocketUrl?: string;
  isConfigured: boolean;
  lastConnectedAt?: string;
  connectionStatus: ConnectionStatus;
  // Note: API key is stored securely in expo-secure-store, not here
  hasApiKey: boolean;
}

/**
 * Notification settings
 */
export interface NotificationSettings {
  enabled: boolean;
  types: {
    [K in NotificationType]: boolean;
  };
  sound: boolean;
  vibration: boolean;
  badge: boolean;
  quietHoursEnabled: boolean;
  quietHoursStart?: string; // HH:mm format
  quietHoursEnd?: string; // HH:mm format
}

/**
 * Display settings
 */
export interface DisplaySettings {
  themeMode: ThemeMode;
  fontSize: 'small' | 'medium' | 'large';
  compactMode: boolean;
  showBadgeCount: boolean;
  hapticFeedback: boolean;
}

/**
 * Security settings
 */
export interface SecuritySettings {
  biometricEnabled: boolean;
  biometricType?: 'fingerprint' | 'face' | 'iris';
  autoLockEnabled: boolean;
  autoLockTimeout: number; // minutes
  requireAuthOnLaunch: boolean;
}

/**
 * Rate limit configuration
 */
export interface RateLimitConfig {
  requestsPerMinute: number;
  tokensPerMinute?: number;
  tokensPerDay?: number;
  currentUsage?: RateLimitUsage;
}

/**
 * Rate limit usage tracking
 */
export interface RateLimitUsage {
  requestsUsed: number;
  tokensUsed?: number;
  resetTime: string;
}

/**
 * Sync settings
 */
export interface SyncSettings {
  autoSync: boolean;
  syncInterval: number; // seconds
  syncOnWifiOnly: boolean;
  lastSyncAt?: string;
}

/**
 * Main app settings
 */
export interface AppSettings {
  // Connection
  connection: ConnectionSettings;

  // Notifications
  notifications: NotificationSettings;

  // Display
  display: DisplaySettings;

  // Security
  security: SecuritySettings;

  // Rate limits
  rateLimits: RateLimitConfig;

  // Sync
  sync: SyncSettings;

  // Onboarding
  onboardingCompleted: boolean;
  firstLaunchAt?: string;

  // Debug
  debugMode: boolean;
  analyticsEnabled: boolean;

  // Version
  lastAppVersion?: string;
}

/**
 * Default notification settings
 */
export const defaultNotificationSettings: NotificationSettings = {
  enabled: true,
  types: {
    task_completed: true,
    task_failed: true,
    task_started: false,
    ai_review_ready: true,
    human_review_needed: true,
    chat_response: false,
    github_update: true,
  },
  sound: true,
  vibration: true,
  badge: true,
  quietHoursEnabled: false,
};

/**
 * Default display settings
 */
export const defaultDisplaySettings: DisplaySettings = {
  themeMode: 'dark',
  fontSize: 'medium',
  compactMode: false,
  showBadgeCount: true,
  hapticFeedback: true,
};

/**
 * Default security settings
 */
export const defaultSecuritySettings: SecuritySettings = {
  biometricEnabled: false,
  autoLockEnabled: false,
  autoLockTimeout: 5,
  requireAuthOnLaunch: false,
};

/**
 * Default sync settings
 */
export const defaultSyncSettings: SyncSettings = {
  autoSync: true,
  syncInterval: 30,
  syncOnWifiOnly: false,
};

/**
 * Default rate limit config
 */
export const defaultRateLimitConfig: RateLimitConfig = {
  requestsPerMinute: 60,
  tokensPerMinute: 100000,
  tokensPerDay: 1000000,
};

/**
 * Settings update input
 */
export interface SettingsUpdateInput {
  connection?: Partial<ConnectionSettings>;
  notifications?: Partial<NotificationSettings>;
  display?: Partial<DisplaySettings>;
  security?: Partial<SecuritySettings>;
  rateLimits?: Partial<RateLimitConfig>;
  sync?: Partial<SyncSettings>;
  debugMode?: boolean;
  analyticsEnabled?: boolean;
}

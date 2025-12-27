/**
 * Settings Screen
 * App configuration and preferences
 * Includes sections for Connection, Theme, Notifications, Claude Profiles, and Rate Limits
 */

import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  RefreshControl,
  Alert,
  Pressable,
} from 'react-native';
import {
  Text,
  Surface,
  Switch,
  Divider,
  TextInput,
  IconButton,
  Portal,
  Modal,
  RadioButton,
  ProgressBar,
  Chip,
} from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { Header } from '../../components';
import {
  useSettingsStore,
  useThemeMode,
  useConnectionSettings,
  useNotificationSettings,
  useDisplaySettings,
} from '../../stores/settingsStore';
import type { ThemeMode, ClaudeProfile } from '../../types';
import { colors, spacing, borderRadius } from '../../theme';

/**
 * Mock Claude profiles for demonstration
 */
const MOCK_CLAUDE_PROFILES: ClaudeProfile[] = [
  {
    id: 'default',
    name: 'Default',
    description: 'General-purpose coding assistant',
    systemPrompt: 'You are a helpful AI coding assistant.',
    temperature: 0.7,
    maxTokens: 4096,
    isDefault: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'reviewer',
    name: 'Code Reviewer',
    description: 'Thorough code review focus',
    systemPrompt: 'You are a meticulous code reviewer. Focus on best practices, performance, and maintainability.',
    temperature: 0.3,
    maxTokens: 8192,
    isDefault: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'architect',
    name: 'System Architect',
    description: 'High-level design and architecture',
    systemPrompt: 'You are a software architect. Focus on system design, scalability, and technical decisions.',
    temperature: 0.5,
    maxTokens: 8192,
    isDefault: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

/**
 * Section header component
 */
const SectionHeader: React.FC<{
  title: string;
  icon: string;
  description?: string;
}> = ({ title, icon, description }) => (
  <View style={styles.sectionHeader}>
    <View style={styles.sectionHeaderIcon}>
      <Icon name={icon} size={20} color={colors.accent.primary} />
    </View>
    <View style={styles.sectionHeaderContent}>
      <Text variant="titleMedium" style={styles.sectionTitle}>
        {title}
      </Text>
      {description && (
        <Text variant="bodySmall" style={styles.sectionDescription}>
          {description}
        </Text>
      )}
    </View>
  </View>
);

/**
 * Setting row component for switch settings
 */
const SettingRow: React.FC<{
  label: string;
  description?: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
  disabled?: boolean;
  icon?: string;
}> = ({ label, description, value, onValueChange, disabled = false, icon }) => (
  <Pressable
    style={styles.settingRow}
    onPress={() => !disabled && onValueChange(!value)}
    disabled={disabled}
    accessibilityRole="switch"
    accessibilityLabel={label}
    accessibilityState={{ checked: value, disabled }}
    accessibilityHint={description}
  >
    {icon && (
      <View style={styles.settingRowIcon}>
        <Icon name={icon} size={20} color={disabled ? colors.text.disabled : colors.text.secondary} />
      </View>
    )}
    <View style={styles.settingRowContent}>
      <Text
        variant="bodyMedium"
        style={[styles.settingLabel, disabled && styles.settingLabelDisabled]}
      >
        {label}
      </Text>
      {description && (
        <Text variant="bodySmall" style={styles.settingDescription}>
          {description}
        </Text>
      )}
    </View>
    <Switch
      value={value}
      onValueChange={onValueChange}
      disabled={disabled}
      color={colors.accent.primary}
    />
  </Pressable>
);

/**
 * Settings tab screen component
 * Displays app configuration organized in sections
 */
export default function SettingsScreen() {
  const insets = useSafeAreaInsets();

  // Store hooks
  const settings = useSettingsStore((state) => state.settings);
  const updateConnectionSettings = useSettingsStore((state) => state.updateConnectionSettings);
  const updateNotificationSettings = useSettingsStore((state) => state.updateNotificationSettings);
  const updateDisplaySettings = useSettingsStore((state) => state.updateDisplaySettings);
  const setThemeMode = useSettingsStore((state) => state.setThemeMode);
  const saveApiKey = useSettingsStore((state) => state.saveApiKey);
  const deleteApiKey = useSettingsStore((state) => state.deleteApiKey);
  const toggleNotificationType = useSettingsStore((state) => state.toggleNotificationType);

  // Selector hooks
  const themeMode = useThemeMode();
  const connectionSettings = useConnectionSettings();
  const notificationSettings = useNotificationSettings();
  const displaySettings = useDisplaySettings();

  // Local state
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showApiKeyModal, setShowApiKeyModal] = useState(false);
  const [showServerUrlModal, setShowServerUrlModal] = useState(false);
  const [showThemeModal, setShowThemeModal] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [serverUrlInput, setServerUrlInput] = useState(connectionSettings.serverUrl);
  const [selectedProfileId, setSelectedProfileId] = useState('default');
  const [showApiKey, setShowApiKey] = useState(false);

  // Rate limit usage calculations
  const rateLimitUsage = useMemo(() => {
    const { rateLimits } = settings;
    const usage = rateLimits.currentUsage || { requestsUsed: 0, tokensUsed: 0 };
    return {
      requestsPercent: Math.min(usage.requestsUsed / rateLimits.requestsPerMinute, 1),
      tokensPercent: rateLimits.tokensPerMinute
        ? Math.min((usage.tokensUsed || 0) / rateLimits.tokensPerMinute, 1)
        : 0,
      requestsUsed: usage.requestsUsed,
      tokensUsed: usage.tokensUsed || 0,
    };
  }, [settings.rateLimits]);

  // Handle pull-to-refresh
  const handleRefresh = useCallback(() => {
    setIsRefreshing(true);
    // Simulate refresh
    setTimeout(() => setIsRefreshing(false), 1000);
  }, []);

  // Connection handlers
  const handleSaveServerUrl = useCallback(() => {
    const trimmedUrl = serverUrlInput.trim();
    if (trimmedUrl) {
      updateConnectionSettings({
        serverUrl: trimmedUrl,
        isConfigured: !!connectionSettings.hasApiKey,
      });
    }
    setShowServerUrlModal(false);
  }, [serverUrlInput, connectionSettings.hasApiKey, updateConnectionSettings]);

  const handleSaveApiKey = useCallback(async () => {
    const trimmedKey = apiKeyInput.trim();
    if (trimmedKey) {
      const success = await saveApiKey(trimmedKey);
      if (success) {
        setApiKeyInput('');
        setShowApiKeyModal(false);
        Alert.alert('Success', 'API key saved securely');
      } else {
        Alert.alert('Error', 'Failed to save API key');
      }
    }
  }, [apiKeyInput, saveApiKey]);

  const handleDeleteApiKey = useCallback(() => {
    Alert.alert(
      'Delete API Key',
      'Are you sure you want to delete the stored API key?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            const success = await deleteApiKey();
            if (success) {
              Alert.alert('Success', 'API key deleted');
            }
          },
        },
      ]
    );
  }, [deleteApiKey]);

  // Theme handler
  const handleThemeChange = useCallback(
    (mode: ThemeMode) => {
      setThemeMode(mode);
      setShowThemeModal(false);
    },
    [setThemeMode]
  );

  // Notifications handler
  const handleNotificationsToggle = useCallback(
    (enabled: boolean) => {
      updateNotificationSettings({ enabled });
    },
    [updateNotificationSettings]
  );

  // Profile handler
  const handleProfileSelect = useCallback((profileId: string) => {
    setSelectedProfileId(profileId);
    setShowProfileModal(false);
  }, []);

  // Get selected profile
  const selectedProfile = useMemo(() => {
    return MOCK_CLAUDE_PROFILES.find((p) => p.id === selectedProfileId) || MOCK_CLAUDE_PROFILES[0];
  }, [selectedProfileId]);

  // Theme label
  const themeLabel = useMemo(() => {
    switch (themeMode) {
      case 'dark':
        return 'Dark';
      case 'light':
        return 'Light';
      case 'system':
        return 'System';
      default:
        return 'Dark';
    }
  }, [themeMode]);

  // Connection status icon and color
  const connectionStatus = useMemo(() => {
    const status = connectionSettings.connectionStatus;
    switch (status) {
      case 'connected':
        return { icon: 'check-circle', color: colors.status.success, label: 'Connected' };
      case 'connecting':
        return { icon: 'loading', color: colors.status.warning, label: 'Connecting...' };
      case 'error':
        return { icon: 'alert-circle', color: colors.status.error, label: 'Error' };
      default:
        return { icon: 'circle-outline', color: colors.text.muted, label: 'Disconnected' };
    }
  }, [connectionSettings.connectionStatus]);

  return (
    <View style={styles.container}>
      {/* Header */}
      <Header
        title="Settings"
        subtitle="App configuration"
        showBorder
        testID="settings-header"
      />

      {/* Scrollable content */}
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: insets.bottom + spacing.xl },
        ]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            colors={[colors.accent.primary]}
            progressBackgroundColor={colors.background.secondary}
            tintColor={colors.accent.primary}
          />
        }
        accessibilityLabel="Settings content"
      >
        {/* Connection Section */}
        <Surface style={styles.section} elevation={1}>
          <SectionHeader
            title="Connection"
            icon="server-network"
            description="Server and API configuration"
          />
          <Divider style={styles.divider} />

          {/* Server URL */}
          <Pressable
            style={styles.settingRow}
            onPress={() => {
              setServerUrlInput(connectionSettings.serverUrl);
              setShowServerUrlModal(true);
            }}
            accessibilityRole="button"
            accessibilityLabel="Server URL"
            accessibilityHint="Tap to change server URL"
          >
            <View style={styles.settingRowIcon}>
              <Icon name="web" size={20} color={colors.text.secondary} />
            </View>
            <View style={styles.settingRowContent}>
              <Text variant="bodyMedium" style={styles.settingLabel}>
                Server URL
              </Text>
              <Text variant="bodySmall" style={styles.settingValue} numberOfLines={1}>
                {connectionSettings.serverUrl || 'Not configured'}
              </Text>
            </View>
            <Icon name="chevron-right" size={24} color={colors.text.muted} />
          </Pressable>

          {/* API Key */}
          <Pressable
            style={styles.settingRow}
            onPress={() => setShowApiKeyModal(true)}
            accessibilityRole="button"
            accessibilityLabel="API Key"
            accessibilityHint="Tap to manage API key"
          >
            <View style={styles.settingRowIcon}>
              <Icon name="key" size={20} color={colors.text.secondary} />
            </View>
            <View style={styles.settingRowContent}>
              <Text variant="bodyMedium" style={styles.settingLabel}>
                API Key
              </Text>
              <View style={styles.apiKeyStatus}>
                {connectionSettings.hasApiKey ? (
                  <>
                    <Icon name="check-circle" size={14} color={colors.status.success} />
                    <Text variant="bodySmall" style={styles.apiKeyStatusText}>
                      Configured (stored securely)
                    </Text>
                  </>
                ) : (
                  <>
                    <Icon name="alert-circle" size={14} color={colors.status.warning} />
                    <Text variant="bodySmall" style={styles.apiKeyStatusTextWarning}>
                      Not configured
                    </Text>
                  </>
                )}
              </View>
            </View>
            <Icon name="chevron-right" size={24} color={colors.text.muted} />
          </Pressable>

          {/* Connection Status */}
          <View style={styles.settingRow}>
            <View style={styles.settingRowIcon}>
              <Icon name={connectionStatus.icon} size={20} color={connectionStatus.color} />
            </View>
            <View style={styles.settingRowContent}>
              <Text variant="bodyMedium" style={styles.settingLabel}>
                Status
              </Text>
              <Text variant="bodySmall" style={[styles.settingValue, { color: connectionStatus.color }]}>
                {connectionStatus.label}
              </Text>
            </View>
          </View>
        </Surface>

        {/* Theme Section */}
        <Surface style={styles.section} elevation={1}>
          <SectionHeader
            title="Theme"
            icon="palette"
            description="Appearance settings"
          />
          <Divider style={styles.divider} />

          {/* Theme Mode */}
          <Pressable
            style={styles.settingRow}
            onPress={() => setShowThemeModal(true)}
            accessibilityRole="button"
            accessibilityLabel="Theme mode"
            accessibilityHint="Tap to change theme"
          >
            <View style={styles.settingRowIcon}>
              <Icon
                name={themeMode === 'dark' ? 'weather-night' : themeMode === 'light' ? 'weather-sunny' : 'theme-light-dark'}
                size={20}
                color={colors.text.secondary}
              />
            </View>
            <View style={styles.settingRowContent}>
              <Text variant="bodyMedium" style={styles.settingLabel}>
                Theme Mode
              </Text>
              <Text variant="bodySmall" style={styles.settingValue}>
                {themeLabel}
              </Text>
            </View>
            <Chip
              mode="outlined"
              compact
              style={styles.themeChip}
              textStyle={styles.themeChipText}
            >
              {themeLabel}
            </Chip>
            <Icon name="chevron-right" size={24} color={colors.text.muted} />
          </Pressable>

          {/* Haptic Feedback */}
          <SettingRow
            label="Haptic Feedback"
            description="Vibration on interactions"
            value={displaySettings.hapticFeedback}
            onValueChange={(value) => updateDisplaySettings({ hapticFeedback: value })}
            icon="vibrate"
          />

          {/* Compact Mode */}
          <SettingRow
            label="Compact Mode"
            description="Show more content on screen"
            value={displaySettings.compactMode}
            onValueChange={(value) => updateDisplaySettings({ compactMode: value })}
            icon="view-compact"
          />
        </Surface>

        {/* Notifications Section */}
        <Surface style={styles.section} elevation={1}>
          <SectionHeader
            title="Notifications"
            icon="bell"
            description="Alert preferences"
          />
          <Divider style={styles.divider} />

          {/* Master Toggle */}
          <SettingRow
            label="Enable Notifications"
            description="Receive push notifications"
            value={notificationSettings.enabled}
            onValueChange={handleNotificationsToggle}
            icon="bell-outline"
          />

          {/* Notification Types */}
          {notificationSettings.enabled && (
            <>
              <Divider style={styles.subDivider} />
              <Text variant="labelMedium" style={styles.subSectionTitle}>
                Notification Types
              </Text>

              <SettingRow
                label="Task Completed"
                value={notificationSettings.types.task_completed}
                onValueChange={(value) => toggleNotificationType('task_completed', value)}
                icon="check-circle-outline"
              />

              <SettingRow
                label="Task Failed"
                value={notificationSettings.types.task_failed}
                onValueChange={(value) => toggleNotificationType('task_failed', value)}
                icon="alert-circle-outline"
              />

              <SettingRow
                label="AI Review Ready"
                value={notificationSettings.types.ai_review_ready}
                onValueChange={(value) => toggleNotificationType('ai_review_ready', value)}
                icon="robot-outline"
              />

              <SettingRow
                label="Human Review Needed"
                value={notificationSettings.types.human_review_needed}
                onValueChange={(value) => toggleNotificationType('human_review_needed', value)}
                icon="account-check-outline"
              />

              <SettingRow
                label="GitHub Updates"
                value={notificationSettings.types.github_update}
                onValueChange={(value) => toggleNotificationType('github_update', value)}
                icon="github"
              />

              <Divider style={styles.subDivider} />
              <Text variant="labelMedium" style={styles.subSectionTitle}>
                Options
              </Text>

              <SettingRow
                label="Sound"
                value={notificationSettings.sound}
                onValueChange={(value) => updateNotificationSettings({ sound: value })}
                icon="volume-high"
              />

              <SettingRow
                label="Vibration"
                value={notificationSettings.vibration}
                onValueChange={(value) => updateNotificationSettings({ vibration: value })}
                icon="vibrate"
              />

              <SettingRow
                label="Badge Count"
                value={notificationSettings.badge}
                onValueChange={(value) => updateNotificationSettings({ badge: value })}
                icon="numeric"
              />
            </>
          )}
        </Surface>

        {/* Claude Profiles Section */}
        <Surface style={styles.section} elevation={1}>
          <SectionHeader
            title="Claude Profiles"
            icon="robot"
            description="AI assistant configurations"
          />
          <Divider style={styles.divider} />

          {/* Current Profile */}
          <Pressable
            style={styles.settingRow}
            onPress={() => setShowProfileModal(true)}
            accessibilityRole="button"
            accessibilityLabel="Active profile"
            accessibilityHint="Tap to change Claude profile"
          >
            <View style={styles.settingRowIcon}>
              <Icon name="account-cog" size={20} color={colors.text.secondary} />
            </View>
            <View style={styles.settingRowContent}>
              <Text variant="bodyMedium" style={styles.settingLabel}>
                Active Profile
              </Text>
              <Text variant="bodySmall" style={styles.settingValue}>
                {selectedProfile.name}
              </Text>
            </View>
            <Chip
              mode="outlined"
              compact
              style={styles.profileChip}
              textStyle={styles.profileChipText}
              icon={({ size }) => (
                <Icon name="robot" size={size - 4} color={colors.accent.primary} />
              )}
            >
              {selectedProfile.name}
            </Chip>
            <Icon name="chevron-right" size={24} color={colors.text.muted} />
          </Pressable>

          {/* Profile Details */}
          <View style={styles.profileDetails}>
            <Text variant="bodySmall" style={styles.profileDescription}>
              {selectedProfile.description}
            </Text>
            <View style={styles.profileMeta}>
              <View style={styles.profileMetaItem}>
                <Icon name="thermometer" size={14} color={colors.text.muted} />
                <Text variant="labelSmall" style={styles.profileMetaText}>
                  Temp: {selectedProfile.temperature}
                </Text>
              </View>
              <View style={styles.profileMetaItem}>
                <Icon name="text-box-outline" size={14} color={colors.text.muted} />
                <Text variant="labelSmall" style={styles.profileMetaText}>
                  Max: {selectedProfile.maxTokens?.toLocaleString()} tokens
                </Text>
              </View>
            </View>
          </View>
        </Surface>

        {/* Rate Limits Section */}
        <Surface style={styles.section} elevation={1}>
          <SectionHeader
            title="Rate Limits"
            icon="speedometer"
            description="API usage and limits"
          />
          <Divider style={styles.divider} />

          {/* Requests per Minute */}
          <View style={styles.rateLimitRow}>
            <View style={styles.rateLimitHeader}>
              <View style={styles.rateLimitLabel}>
                <Icon name="clock-outline" size={18} color={colors.text.secondary} />
                <Text variant="bodyMedium" style={styles.settingLabel}>
                  Requests/min
                </Text>
              </View>
              <Text variant="labelMedium" style={styles.rateLimitValue}>
                {rateLimitUsage.requestsUsed} / {settings.rateLimits.requestsPerMinute}
              </Text>
            </View>
            <ProgressBar
              progress={rateLimitUsage.requestsPercent}
              color={rateLimitUsage.requestsPercent > 0.8 ? colors.status.error : colors.accent.primary}
              style={styles.progressBar}
            />
          </View>

          {/* Tokens per Minute */}
          {settings.rateLimits.tokensPerMinute && (
            <View style={styles.rateLimitRow}>
              <View style={styles.rateLimitHeader}>
                <View style={styles.rateLimitLabel}>
                  <Icon name="text-box-multiple-outline" size={18} color={colors.text.secondary} />
                  <Text variant="bodyMedium" style={styles.settingLabel}>
                    Tokens/min
                  </Text>
                </View>
                <Text variant="labelMedium" style={styles.rateLimitValue}>
                  {rateLimitUsage.tokensUsed.toLocaleString()} / {settings.rateLimits.tokensPerMinute.toLocaleString()}
                </Text>
              </View>
              <ProgressBar
                progress={rateLimitUsage.tokensPercent}
                color={rateLimitUsage.tokensPercent > 0.8 ? colors.status.error : colors.accent.primary}
                style={styles.progressBar}
              />
            </View>
          )}

          {/* Daily Token Limit */}
          {settings.rateLimits.tokensPerDay && (
            <View style={styles.rateLimitRow}>
              <View style={styles.rateLimitHeader}>
                <View style={styles.rateLimitLabel}>
                  <Icon name="calendar-today" size={18} color={colors.text.secondary} />
                  <Text variant="bodyMedium" style={styles.settingLabel}>
                    Daily Limit
                  </Text>
                </View>
                <Text variant="labelMedium" style={styles.rateLimitValue}>
                  {settings.rateLimits.tokensPerDay.toLocaleString()} tokens
                </Text>
              </View>
            </View>
          )}

          {/* Rate Limit Info */}
          <View style={styles.rateLimitInfo}>
            <Icon name="information-outline" size={16} color={colors.text.muted} />
            <Text variant="bodySmall" style={styles.rateLimitInfoText}>
              Limits reset every minute. Configure in AutoClaude desktop settings.
            </Text>
          </View>
        </Surface>

        {/* App Info */}
        <Surface style={styles.section} elevation={1}>
          <SectionHeader
            title="About"
            icon="information"
            description="App information"
          />
          <Divider style={styles.divider} />

          <View style={styles.appInfo}>
            <Text variant="bodySmall" style={styles.appInfoText}>
              AutoClaude Mobile Companion
            </Text>
            <Text variant="labelSmall" style={styles.appInfoVersion}>
              Version 1.0.0 (Build 1)
            </Text>
          </View>
        </Surface>
      </ScrollView>

      {/* Modals */}
      <Portal>
        {/* Server URL Modal */}
        <Modal
          visible={showServerUrlModal}
          onDismiss={() => setShowServerUrlModal(false)}
          contentContainerStyle={styles.modal}
        >
          <Text variant="titleMedium" style={styles.modalTitle}>
            Server URL
          </Text>
          <TextInput
            value={serverUrlInput}
            onChangeText={setServerUrlInput}
            mode="outlined"
            placeholder="https://your-server.com"
            style={styles.modalInput}
            outlineColor={colors.surface.border}
            activeOutlineColor={colors.accent.primary}
            textColor={colors.text.primary}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
          />
          <View style={styles.modalActions}>
            <Pressable
              onPress={() => setShowServerUrlModal(false)}
              style={styles.modalButton}
            >
              <Text style={styles.modalButtonText}>Cancel</Text>
            </Pressable>
            <Pressable
              onPress={handleSaveServerUrl}
              style={[styles.modalButton, styles.modalButtonPrimary]}
            >
              <Text style={[styles.modalButtonText, styles.modalButtonTextPrimary]}>
                Save
              </Text>
            </Pressable>
          </View>
        </Modal>

        {/* API Key Modal */}
        <Modal
          visible={showApiKeyModal}
          onDismiss={() => setShowApiKeyModal(false)}
          contentContainerStyle={styles.modal}
        >
          <Text variant="titleMedium" style={styles.modalTitle}>
            API Key
          </Text>
          <Text variant="bodySmall" style={styles.modalDescription}>
            Your API key is stored securely using device encryption.
          </Text>
          <View style={styles.apiKeyInputContainer}>
            <TextInput
              value={apiKeyInput}
              onChangeText={setApiKeyInput}
              mode="outlined"
              placeholder="sk-ant-..."
              style={styles.modalInput}
              outlineColor={colors.surface.border}
              activeOutlineColor={colors.accent.primary}
              textColor={colors.text.primary}
              autoCapitalize="none"
              autoCorrect={false}
              secureTextEntry={!showApiKey}
            />
            <IconButton
              icon={showApiKey ? 'eye-off' : 'eye'}
              size={20}
              onPress={() => setShowApiKey(!showApiKey)}
              style={styles.apiKeyToggle}
              accessibilityLabel={showApiKey ? 'Hide API key' : 'Show API key'}
            />
          </View>
          <View style={styles.modalActions}>
            {connectionSettings.hasApiKey && (
              <Pressable
                onPress={() => {
                  setShowApiKeyModal(false);
                  handleDeleteApiKey();
                }}
                style={[styles.modalButton, styles.modalButtonDestructive]}
              >
                <Text style={styles.modalButtonTextDestructive}>Delete</Text>
              </Pressable>
            )}
            <View style={styles.modalActionsSpacer} />
            <Pressable
              onPress={() => setShowApiKeyModal(false)}
              style={styles.modalButton}
            >
              <Text style={styles.modalButtonText}>Cancel</Text>
            </Pressable>
            <Pressable
              onPress={handleSaveApiKey}
              style={[styles.modalButton, styles.modalButtonPrimary]}
            >
              <Text style={[styles.modalButtonText, styles.modalButtonTextPrimary]}>
                Save
              </Text>
            </Pressable>
          </View>
        </Modal>

        {/* Theme Modal */}
        <Modal
          visible={showThemeModal}
          onDismiss={() => setShowThemeModal(false)}
          contentContainerStyle={styles.modal}
        >
          <Text variant="titleMedium" style={styles.modalTitle}>
            Theme Mode
          </Text>
          <RadioButton.Group onValueChange={(value) => handleThemeChange(value as ThemeMode)} value={themeMode}>
            <Pressable
              style={styles.radioRow}
              onPress={() => handleThemeChange('dark')}
              accessibilityRole="radio"
              accessibilityState={{ checked: themeMode === 'dark' }}
            >
              <RadioButton value="dark" color={colors.accent.primary} />
              <Icon name="weather-night" size={20} color={colors.text.secondary} style={styles.radioIcon} />
              <View style={styles.radioContent}>
                <Text style={styles.radioLabel}>Dark</Text>
                <Text variant="bodySmall" style={styles.radioDescription}>
                  Dark theme for low-light environments
                </Text>
              </View>
            </Pressable>

            <Pressable
              style={styles.radioRow}
              onPress={() => handleThemeChange('light')}
              accessibilityRole="radio"
              accessibilityState={{ checked: themeMode === 'light' }}
            >
              <RadioButton value="light" color={colors.accent.primary} />
              <Icon name="weather-sunny" size={20} color={colors.text.secondary} style={styles.radioIcon} />
              <View style={styles.radioContent}>
                <Text style={styles.radioLabel}>Light</Text>
                <Text variant="bodySmall" style={styles.radioDescription}>
                  Light theme for bright environments
                </Text>
              </View>
            </Pressable>

            <Pressable
              style={styles.radioRow}
              onPress={() => handleThemeChange('system')}
              accessibilityRole="radio"
              accessibilityState={{ checked: themeMode === 'system' }}
            >
              <RadioButton value="system" color={colors.accent.primary} />
              <Icon name="theme-light-dark" size={20} color={colors.text.secondary} style={styles.radioIcon} />
              <View style={styles.radioContent}>
                <Text style={styles.radioLabel}>System</Text>
                <Text variant="bodySmall" style={styles.radioDescription}>
                  Follow device settings
                </Text>
              </View>
            </Pressable>
          </RadioButton.Group>
        </Modal>

        {/* Profile Modal */}
        <Modal
          visible={showProfileModal}
          onDismiss={() => setShowProfileModal(false)}
          contentContainerStyle={styles.modal}
        >
          <Text variant="titleMedium" style={styles.modalTitle}>
            Claude Profiles
          </Text>
          <Text variant="bodySmall" style={styles.modalDescription}>
            Select a profile to customize AI behavior.
          </Text>
          <View style={styles.profileList}>
            {MOCK_CLAUDE_PROFILES.map((profile) => (
              <Pressable
                key={profile.id}
                style={[
                  styles.profileItem,
                  selectedProfileId === profile.id && styles.profileItemSelected,
                ]}
                onPress={() => handleProfileSelect(profile.id)}
                accessibilityRole="radio"
                accessibilityState={{ checked: selectedProfileId === profile.id }}
                accessibilityLabel={profile.name}
              >
                <View style={styles.profileItemIcon}>
                  <Icon
                    name={selectedProfileId === profile.id ? 'robot' : 'robot-outline'}
                    size={24}
                    color={selectedProfileId === profile.id ? colors.accent.primary : colors.text.secondary}
                  />
                </View>
                <View style={styles.profileItemContent}>
                  <Text
                    variant="bodyMedium"
                    style={[
                      styles.profileItemName,
                      selectedProfileId === profile.id && styles.profileItemNameSelected,
                    ]}
                  >
                    {profile.name}
                    {profile.isDefault && (
                      <Text style={styles.profileItemDefault}> (Default)</Text>
                    )}
                  </Text>
                  <Text variant="bodySmall" style={styles.profileItemDescription}>
                    {profile.description}
                  </Text>
                </View>
                {selectedProfileId === profile.id && (
                  <Icon name="check" size={20} color={colors.accent.primary} />
                )}
              </Pressable>
            ))}
          </View>
        </Modal>
      </Portal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.primary,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingTop: spacing.md,
    paddingHorizontal: spacing.md,
    gap: spacing.md,
  },
  // Section styles
  section: {
    backgroundColor: colors.background.secondary,
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    gap: spacing.sm,
  },
  sectionHeaderIcon: {
    width: 36,
    height: 36,
    borderRadius: borderRadius.md,
    backgroundColor: colors.accent.primary + '20',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionHeaderContent: {
    flex: 1,
  },
  sectionTitle: {
    color: colors.text.primary,
    fontWeight: '600',
  },
  sectionDescription: {
    color: colors.text.secondary,
    marginTop: 2,
  },
  divider: {
    backgroundColor: colors.surface.divider,
  },
  subDivider: {
    backgroundColor: colors.surface.divider,
    marginVertical: spacing.sm,
    marginHorizontal: spacing.md,
  },
  subSectionTitle: {
    color: colors.text.muted,
    marginHorizontal: spacing.md,
    marginBottom: spacing.xs,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  // Setting row styles
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    minHeight: 56,
  },
  settingRowIcon: {
    width: 32,
    alignItems: 'center',
    marginRight: spacing.sm,
  },
  settingRowContent: {
    flex: 1,
  },
  settingLabel: {
    color: colors.text.primary,
  },
  settingLabelDisabled: {
    color: colors.text.disabled,
  },
  settingDescription: {
    color: colors.text.secondary,
    marginTop: 2,
  },
  settingValue: {
    color: colors.text.muted,
    marginTop: 2,
  },
  // API key styles
  apiKeyStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: 2,
  },
  apiKeyStatusText: {
    color: colors.status.success,
    fontSize: 12,
  },
  apiKeyStatusTextWarning: {
    color: colors.status.warning,
    fontSize: 12,
  },
  // Theme chip
  themeChip: {
    marginRight: spacing.xs,
    backgroundColor: colors.background.tertiary,
    borderColor: colors.surface.border,
  },
  themeChipText: {
    color: colors.text.secondary,
    fontSize: 12,
  },
  // Profile styles
  profileChip: {
    marginRight: spacing.xs,
    backgroundColor: colors.accent.primary + '20',
    borderColor: colors.accent.primary + '40',
  },
  profileChipText: {
    color: colors.accent.primary,
    fontSize: 12,
  },
  profileDetails: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
    paddingTop: spacing.xs,
  },
  profileDescription: {
    color: colors.text.secondary,
  },
  profileMeta: {
    flexDirection: 'row',
    gap: spacing.lg,
    marginTop: spacing.sm,
  },
  profileMetaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  profileMetaText: {
    color: colors.text.muted,
  },
  // Rate limit styles
  rateLimitRow: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  rateLimitHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  rateLimitLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  rateLimitValue: {
    color: colors.text.secondary,
  },
  progressBar: {
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.surface.primary,
  },
  rateLimitInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
    paddingTop: spacing.xs,
  },
  rateLimitInfoText: {
    color: colors.text.muted,
    flex: 1,
  },
  // App info styles
  appInfo: {
    padding: spacing.md,
    alignItems: 'center',
  },
  appInfoText: {
    color: colors.text.secondary,
  },
  appInfoVersion: {
    color: colors.text.muted,
    marginTop: spacing.xs,
  },
  // Modal styles
  modal: {
    backgroundColor: colors.background.elevated,
    marginHorizontal: spacing.lg,
    padding: spacing.lg,
    borderRadius: borderRadius.lg,
  },
  modalTitle: {
    color: colors.text.primary,
    fontWeight: 'bold',
    marginBottom: spacing.sm,
  },
  modalDescription: {
    color: colors.text.secondary,
    marginBottom: spacing.md,
  },
  modalInput: {
    backgroundColor: colors.background.tertiary,
    marginBottom: spacing.md,
  },
  apiKeyInputContainer: {
    position: 'relative',
  },
  apiKeyToggle: {
    position: 'absolute',
    right: 0,
    top: 6,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: spacing.sm,
  },
  modalActionsSpacer: {
    flex: 1,
  },
  modalButton: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
  },
  modalButtonPrimary: {
    backgroundColor: colors.accent.primary,
  },
  modalButtonDestructive: {
    backgroundColor: colors.status.error + '20',
  },
  modalButtonText: {
    color: colors.text.secondary,
    fontWeight: '500',
  },
  modalButtonTextPrimary: {
    color: colors.text.inverse,
  },
  modalButtonTextDestructive: {
    color: colors.status.error,
    fontWeight: '500',
  },
  // Radio button styles
  radioRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  radioIcon: {
    marginRight: spacing.sm,
  },
  radioContent: {
    flex: 1,
  },
  radioLabel: {
    color: colors.text.primary,
    fontSize: 16,
  },
  radioDescription: {
    color: colors.text.secondary,
    marginTop: 2,
  },
  // Profile list styles
  profileList: {
    marginTop: spacing.sm,
  },
  profileItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    borderRadius: borderRadius.md,
    marginBottom: spacing.xs,
  },
  profileItemSelected: {
    backgroundColor: colors.accent.primary + '15',
  },
  profileItemIcon: {
    width: 40,
    height: 40,
    borderRadius: borderRadius.round,
    backgroundColor: colors.surface.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
  },
  profileItemContent: {
    flex: 1,
  },
  profileItemName: {
    color: colors.text.primary,
    fontWeight: '500',
  },
  profileItemNameSelected: {
    color: colors.accent.primary,
  },
  profileItemDefault: {
    color: colors.text.muted,
    fontWeight: 'normal',
    fontSize: 12,
  },
  profileItemDescription: {
    color: colors.text.secondary,
    marginTop: 2,
  },
});

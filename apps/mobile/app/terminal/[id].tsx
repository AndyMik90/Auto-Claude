/**
 * Terminal Detail Screen
 * Displays terminal output for a specific session with real-time streaming
 * Read-only terminal viewer with auto-scroll and display settings
 */

import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import {
  StyleSheet,
  View,
  Pressable,
  Platform,
} from 'react-native';
import {
  Text,
  Surface,
  IconButton,
  Chip,
  Portal,
  Modal,
  Switch,
  Divider,
  RadioButton,
  Button,
} from 'react-native-paper';
import { useLocalSearchParams, Stack, router } from 'expo-router';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { colors, spacing, borderRadius, shadows } from '../../theme';
import {
  useTerminalStore,
  useSelectedSession,
  useTerminalDisplaySettings,
  useIsAutoScrollEnabled,
} from '../../stores/terminalStore';
import { TerminalOutput } from '../../components/TerminalOutput';
import { EmptyState } from '../../components/EmptyState';
import type { TerminalSession, TerminalStatus, TerminalDisplaySettings } from '../../types';

/**
 * Get status color
 */
const getStatusColor = (status: TerminalStatus): string => {
  const statusColors: Record<TerminalStatus, string> = {
    active: colors.status.success,
    idle: colors.status.info,
    closed: colors.text.muted,
    error: colors.status.error,
  };
  return statusColors[status] || colors.text.muted;
};

/**
 * Get status label
 */
const getStatusLabel = (status: TerminalStatus): string => {
  const labels: Record<TerminalStatus, string> = {
    active: 'Active',
    idle: 'Idle',
    closed: 'Closed',
    error: 'Error',
  };
  return labels[status] || status;
};

/**
 * Terminal Detail Screen Component
 */
export default function TerminalDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();

  // Store state
  const getSessionById = useTerminalStore((state) => state.getSessionById);
  const selectSession = useTerminalStore((state) => state.selectSession);
  const updateScrollState = useTerminalStore((state) => state.updateScrollState);
  const updateDisplaySettings = useTerminalStore((state) => state.updateDisplaySettings);
  const simulateOutput = useTerminalStore((state) => state.simulateOutput);
  const displaySettings = useTerminalDisplaySettings();
  const sessions = useTerminalStore((state) => state.sessions);

  // Get session (reactive to changes)
  const session = useMemo(() => {
    return id ? getSessionById(id) : undefined;
  }, [id, getSessionById, sessions]);

  // Local state
  const [settingsVisible, setSettingsVisible] = useState(false);
  const [localSettings, setLocalSettings] = useState<TerminalDisplaySettings>(displaySettings);
  const simulationIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Select session on mount
  useEffect(() => {
    if (id) {
      selectSession(id);
    }
    return () => {
      selectSession(null);
    };
  }, [id, selectSession]);

  // Simulate real-time output for active sessions
  useEffect(() => {
    if (!session || session.status !== 'active') {
      if (simulationIntervalRef.current) {
        clearInterval(simulationIntervalRef.current);
        simulationIntervalRef.current = null;
      }
      return;
    }

    // Simulate output every 2-4 seconds
    const startSimulation = () => {
      simulationIntervalRef.current = setInterval(() => {
        if (!session) return;

        const outputTypes = [
          { type: 'stdout' as const, messages: [
            'Compiling source files...',
            'Processing module dependencies...',
            'Bundling assets...',
            'Optimizing output...',
            'Writing output files...',
            '> Module compiled successfully',
            'Running type checks...',
            'Validating schemas...',
          ]},
          { type: 'info' as const, messages: [
            '[Claude] Analyzing codebase structure...',
            '[Claude] Identifying patterns...',
            '[Claude] Generating implementation...',
            '[Claude] Reviewing code changes...',
            '[Claude] Running quality checks...',
          ]},
          { type: 'command' as const, messages: [
            '$ npm run build',
            '$ npm test',
            '$ git status',
            '$ npx tsc --noEmit',
          ]},
          { type: 'warning' as const, messages: [
            'Warning: Deprecated API detected',
            'Warning: Consider updating dependency',
          ]},
        ];

        const categoryIndex = Math.floor(Math.random() * outputTypes.length);
        const category = outputTypes[categoryIndex];
        const messageIndex = Math.floor(Math.random() * category.messages.length);
        const message = category.messages[messageIndex];

        simulateOutput(session.id, category.type, message);
      }, 2000 + Math.random() * 2000);
    };

    startSimulation();

    return () => {
      if (simulationIntervalRef.current) {
        clearInterval(simulationIntervalRef.current);
        simulationIntervalRef.current = null;
      }
    };
  }, [session?.id, session?.status, simulateOutput]);

  // Handle scroll state change
  const handleScrollStateChange = useCallback(
    (isAutoScrollEnabled: boolean) => {
      if (id) {
        updateScrollState(id, { isAutoScrollEnabled });
      }
    },
    [id, updateScrollState]
  );

  // Handle opening settings
  const handleOpenSettings = useCallback(() => {
    setLocalSettings(displaySettings);
    setSettingsVisible(true);
  }, [displaySettings]);

  // Handle closing settings
  const handleCloseSettings = useCallback(() => {
    setSettingsVisible(false);
  }, []);

  // Handle saving settings
  const handleSaveSettings = useCallback(() => {
    updateDisplaySettings(localSettings);
    setSettingsVisible(false);
  }, [localSettings, updateDisplaySettings]);

  // Handle settings change
  const handleSettingChange = useCallback(
    <K extends keyof TerminalDisplaySettings>(
      key: K,
      value: TerminalDisplaySettings[K]
    ) => {
      setLocalSettings((prev) => ({ ...prev, [key]: value }));
    },
    []
  );

  // Handle navigation to linked task
  const handleNavigateToTask = useCallback(() => {
    if (session?.taskId) {
      router.push(`/task/${session.taskId}`);
    }
  }, [session?.taskId]);

  // Handle going back
  const handleGoBack = useCallback(() => {
    router.back();
  }, []);

  // Handle not found
  if (!session) {
    return (
      <>
        <Stack.Screen
          options={{
            title: 'Terminal Not Found',
            headerStyle: { backgroundColor: colors.background.secondary },
            headerTintColor: colors.text.primary,
          }}
        />
        <View style={styles.container}>
          <EmptyState
            icon="console"
            title="Terminal Session Not Found"
            description="The requested terminal session could not be found. It may have been closed or removed."
            actionLabel="Go Back"
            onAction={handleGoBack}
          />
        </View>
      </>
    );
  }

  const statusColor = getStatusColor(session.status);
  const statusLabel = getStatusLabel(session.status);

  return (
    <>
      <Stack.Screen
        options={{
          title: 'Terminal',
          headerStyle: { backgroundColor: colors.background.secondary },
          headerTintColor: colors.text.primary,
          headerShadowVisible: false,
          headerRight: () => (
            <View style={styles.headerRight}>
              <IconButton
                icon="cog"
                iconColor={colors.text.muted}
                size={22}
                onPress={handleOpenSettings}
                accessibilityLabel="Terminal settings"
                accessibilityHint="Open display settings for this terminal"
              />
            </View>
          ),
        }}
      />

      <View style={styles.container}>
        {/* Session Header */}
        <Surface style={styles.headerCard} elevation={1}>
          <View style={styles.headerTop}>
            <View style={styles.headerInfo}>
              {/* Status indicator */}
              <View
                style={[styles.statusIndicator, { backgroundColor: statusColor }]}
                accessibilityLabel={`Status: ${statusLabel}`}
              />
              {session.status === 'active' && (
                <View
                  style={[styles.pulseRing, { borderColor: statusColor }]}
                  accessibilityElementsHidden
                />
              )}

              {/* Title and status */}
              <View style={styles.titleContainer}>
                <Text variant="titleMedium" style={styles.sessionName} numberOfLines={1}>
                  {session.name}
                </Text>
                <View style={styles.statusRow}>
                  <Chip
                    style={[styles.statusChip, { backgroundColor: statusColor + '20' }]}
                    textStyle={[styles.statusChipText, { color: statusColor }]}
                    compact
                  >
                    {statusLabel}
                  </Chip>
                  <Text style={styles.lineCount}>
                    {session.outputLineCount.toLocaleString()} lines
                  </Text>
                </View>
              </View>
            </View>

            {/* Actions */}
            <View style={styles.headerActions}>
              {session.taskId && (
                <IconButton
                  icon="checkbox-marked-circle-outline"
                  iconColor={colors.accent.primary}
                  size={22}
                  onPress={handleNavigateToTask}
                  accessibilityLabel="Go to linked task"
                  accessibilityHint={`Navigate to task: ${session.taskTitle}`}
                />
              )}
            </View>
          </View>

          {/* Current command */}
          {session.currentCommand && (
            <View style={styles.commandContainer}>
              <MaterialCommunityIcons
                name="chevron-right"
                size={16}
                color={colors.accent.primary}
              />
              <Text style={styles.currentCommand} numberOfLines={1}>
                {session.currentCommand}
              </Text>
            </View>
          )}

          {/* Task link */}
          {session.taskTitle && (
            <Pressable
              style={styles.taskLink}
              onPress={handleNavigateToTask}
              accessibilityLabel={`Linked to task: ${session.taskTitle}`}
              accessibilityRole="link"
            >
              <MaterialCommunityIcons
                name="link-variant"
                size={14}
                color={colors.text.muted}
              />
              <Text style={styles.taskLinkText} numberOfLines={1}>
                Task: {session.taskTitle}
              </Text>
              <MaterialCommunityIcons
                name="chevron-right"
                size={14}
                color={colors.text.muted}
              />
            </Pressable>
          )}

          {/* Process info */}
          {session.process && (
            <View style={styles.processInfo}>
              <Text style={styles.processText}>
                PID: {session.process.pid}
              </Text>
              <Text style={styles.processText}>
                {session.process.command} {session.process.args?.join(' ')}
              </Text>
              {session.process.exitCode !== undefined && (
                <Text
                  style={[
                    styles.exitCode,
                    {
                      color:
                        session.process.exitCode === 0
                          ? colors.status.success
                          : colors.status.error,
                    },
                  ]}
                >
                  Exit: {session.process.exitCode}
                </Text>
              )}
            </View>
          )}
        </Surface>

        {/* Terminal Output */}
        <View style={styles.terminalContainer}>
          <TerminalOutput
            lines={session.output}
            isActive={session.status === 'active'}
            displaySettings={displaySettings}
            onScrollStateChange={handleScrollStateChange}
            initialAutoScroll={true}
            maxLines={1000}
            showHeader={false}
            sessionName={session.name}
            testID="terminal-output"
          />
        </View>
      </View>

      {/* Settings Modal */}
      <Portal>
        <Modal
          visible={settingsVisible}
          onDismiss={handleCloseSettings}
          contentContainerStyle={styles.modalContent}
        >
          <Text variant="titleLarge" style={styles.modalTitle}>
            Display Settings
          </Text>

          {/* Font Size */}
          <View style={styles.settingItem}>
            <Text style={styles.settingLabel}>Font Size</Text>
            <View style={styles.radioGroup}>
              {(['small', 'medium', 'large'] as const).map((size) => (
                <Pressable
                  key={size}
                  style={[
                    styles.radioOption,
                    localSettings.fontSize === size && styles.radioOptionSelected,
                  ]}
                  onPress={() => handleSettingChange('fontSize', size)}
                  accessibilityLabel={`Font size: ${size}`}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: localSettings.fontSize === size }}
                >
                  <Text
                    style={[
                      styles.radioLabel,
                      localSettings.fontSize === size && styles.radioLabelSelected,
                    ]}
                  >
                    {size.charAt(0).toUpperCase() + size.slice(1)}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>

          <Divider style={styles.settingDivider} />

          {/* Word Wrap */}
          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <Text style={styles.settingLabel}>Word Wrap</Text>
              <Text style={styles.settingDescription}>
                Wrap long lines to fit the screen
              </Text>
            </View>
            <Switch
              value={localSettings.wordWrap}
              onValueChange={(value) => handleSettingChange('wordWrap', value)}
              color={colors.accent.primary}
              accessibilityLabel="Toggle word wrap"
            />
          </View>

          <Divider style={styles.settingDivider} />

          {/* Show Timestamps */}
          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <Text style={styles.settingLabel}>Show Timestamps</Text>
              <Text style={styles.settingDescription}>
                Display time for each output line
              </Text>
            </View>
            <Switch
              value={localSettings.showTimestamps}
              onValueChange={(value) => handleSettingChange('showTimestamps', value)}
              color={colors.accent.primary}
              accessibilityLabel="Toggle timestamps"
            />
          </View>

          <Divider style={styles.settingDivider} />

          {/* Show Line Numbers */}
          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <Text style={styles.settingLabel}>Show Line Numbers</Text>
              <Text style={styles.settingDescription}>
                Display line numbers in the output
              </Text>
            </View>
            <Switch
              value={localSettings.showLineNumbers}
              onValueChange={(value) => handleSettingChange('showLineNumbers', value)}
              color={colors.accent.primary}
              accessibilityLabel="Toggle line numbers"
            />
          </View>

          {/* Action Buttons */}
          <View style={styles.modalActions}>
            <Button
              mode="outlined"
              onPress={handleCloseSettings}
              style={styles.modalButton}
              textColor={colors.text.secondary}
            >
              Cancel
            </Button>
            <Button
              mode="contained"
              onPress={handleSaveSettings}
              style={styles.modalButton}
              buttonColor={colors.accent.primary}
              textColor={colors.text.primary}
            >
              Save
            </Button>
          </View>
        </Modal>
      </Portal>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.primary,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerCard: {
    backgroundColor: colors.background.secondary,
    marginHorizontal: spacing.md,
    marginTop: spacing.md,
    borderRadius: borderRadius.md,
    padding: spacing.md,
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  headerInfo: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    flex: 1,
    gap: spacing.sm,
  },
  statusIndicator: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginTop: 4,
  },
  pulseRing: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    opacity: 0.3,
  },
  titleContainer: {
    flex: 1,
  },
  sessionName: {
    color: colors.text.primary,
    fontWeight: '600',
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  statusChip: {
    height: 22,
  },
  statusChipText: {
    fontSize: 11,
    fontWeight: '600',
  },
  lineCount: {
    color: colors.text.muted,
    fontSize: 12,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  commandContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.surface.divider,
    gap: spacing.xs,
  },
  currentCommand: {
    color: colors.accent.primary,
    fontSize: 13,
    fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace' }),
    flex: 1,
  },
  taskLink: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.sm,
    gap: spacing.xs,
  },
  taskLinkText: {
    color: colors.text.muted,
    fontSize: 12,
    flex: 1,
  },
  processInfo: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.surface.divider,
  },
  processText: {
    color: colors.text.muted,
    fontSize: 11,
    fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace' }),
  },
  exitCode: {
    fontSize: 11,
    fontWeight: '600',
    fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace' }),
  },
  terminalContainer: {
    flex: 1,
    marginHorizontal: spacing.md,
    marginVertical: spacing.md,
    borderRadius: borderRadius.md,
    overflow: 'hidden',
    ...shadows.small,
  },
  // Modal Styles
  modalContent: {
    backgroundColor: colors.background.secondary,
    marginHorizontal: spacing.lg,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
  },
  modalTitle: {
    color: colors.text.primary,
    fontWeight: 'bold',
    marginBottom: spacing.lg,
    textAlign: 'center',
  },
  settingItem: {
    marginBottom: spacing.md,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
  },
  settingInfo: {
    flex: 1,
    marginRight: spacing.md,
  },
  settingLabel: {
    color: colors.text.primary,
    fontSize: 14,
    fontWeight: '500',
    marginBottom: spacing.xs,
  },
  settingDescription: {
    color: colors.text.muted,
    fontSize: 12,
  },
  settingDivider: {
    backgroundColor: colors.surface.divider,
    marginVertical: spacing.xs,
  },
  radioGroup: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  radioOption: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.sm,
    backgroundColor: colors.surface.primary,
    borderWidth: 1,
    borderColor: colors.surface.border,
  },
  radioOptionSelected: {
    backgroundColor: colors.accent.primary + '20',
    borderColor: colors.accent.primary,
  },
  radioLabel: {
    color: colors.text.secondary,
    fontSize: 13,
  },
  radioLabelSelected: {
    color: colors.accent.primary,
    fontWeight: '600',
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: spacing.sm,
    marginTop: spacing.lg,
  },
  modalButton: {
    minWidth: 100,
  },
});

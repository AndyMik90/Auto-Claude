/**
 * TerminalListItem Component
 * Displays a terminal session in a list with status, last command, and output preview
 * Supports onPress for navigation to terminal viewer
 */

import React, { useCallback, useMemo } from 'react';
import { StyleSheet, View, Pressable, Platform } from 'react-native';
import { Surface, Text, Avatar } from 'react-native-paper';
import { useRouter } from 'expo-router';
import type { TerminalSession, TerminalStatus } from '../types';
import { colors, spacing, borderRadius, shadows } from '../theme';

/**
 * Props for the TerminalListItem component
 */
interface TerminalListItemProps {
  /** The terminal session to display */
  session: TerminalSession;
  /** Called when the item is pressed (navigation) */
  onPress?: (session: TerminalSession) => void;
  /** Called when the item is long-pressed (quick actions) */
  onLongPress?: (session: TerminalSession) => void;
  /** Whether to show the output preview */
  showPreview?: boolean;
  /** Whether the item is selected */
  isSelected?: boolean;
  /** Whether the item is disabled */
  disabled?: boolean;
  /** Test ID for testing purposes */
  testID?: string;
}

/**
 * Get the color for a terminal status
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
 * Get icon for terminal status
 */
const getStatusIcon = (status: TerminalStatus): string => {
  const icons: Record<TerminalStatus, string> = {
    active: 'console',
    idle: 'console-line',
    closed: 'console',
    error: 'alert-circle',
  };
  return icons[status] || 'console';
};

/**
 * Get display label for status
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
 * Format relative time from date string
 */
const formatRelativeTime = (dateString?: string): string => {
  if (!dateString) return 'Never';

  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
};

/**
 * Truncate and clean command for display
 */
const formatCommand = (command?: string, maxLength: number = 50): string => {
  if (!command) return 'No command';
  // Remove leading $ or > if present
  const cleaned = command.replace(/^[$>]\s*/, '').trim();
  if (cleaned.length <= maxLength) return cleaned;
  return cleaned.substring(0, maxLength - 3) + '...';
};

/**
 * Get last output lines for preview
 */
const getOutputPreview = (session: TerminalSession, maxLines: number = 2): string[] => {
  if (!session.output || session.output.length === 0) return [];
  return session.output
    .slice(-maxLines)
    .map((line) => {
      const content = line.content.trim();
      return content.length > 60 ? content.substring(0, 57) + '...' : content;
    })
    .filter((line) => line.length > 0);
};

/**
 * TerminalListItem Component
 * A list item component for displaying terminal session information
 */
export const TerminalListItem: React.FC<TerminalListItemProps> = ({
  session,
  onPress,
  onLongPress,
  showPreview = true,
  isSelected = false,
  disabled = false,
  testID,
}) => {
  const router = useRouter();

  // Memoize handlers
  const handlePress = useCallback(() => {
    if (!disabled) {
      if (onPress) {
        onPress(session);
      } else {
        router.push(`/terminal/${session.id}`);
      }
    }
  }, [disabled, onPress, session, router]);

  const handleLongPress = useCallback(() => {
    if (!disabled && onLongPress) {
      onLongPress(session);
    }
  }, [disabled, onLongPress, session]);

  // Memoize computed values
  const statusColor = useMemo(() => getStatusColor(session.status), [session.status]);
  const statusIcon = useMemo(() => getStatusIcon(session.status), [session.status]);
  const statusLabel = useMemo(() => getStatusLabel(session.status), [session.status]);
  const lastActivity = useMemo(
    () => formatRelativeTime(session.lastActivityAt || session.updatedAt),
    [session.lastActivityAt, session.updatedAt]
  );
  const currentCommand = useMemo(
    () => formatCommand(session.currentCommand),
    [session.currentCommand]
  );
  const outputPreview = useMemo(
    () => (showPreview ? getOutputPreview(session) : []),
    [session, showPreview]
  );

  // Generate accessibility label
  const accessibilityLabel = useMemo(() => {
    const parts = [
      `Terminal session: ${session.name}`,
      `Status: ${statusLabel}`,
      `${session.outputLineCount} output lines`,
    ];
    if (session.currentCommand) {
      parts.push(`Current command: ${session.currentCommand}`);
    }
    if (session.taskTitle) {
      parts.push(`Associated with task: ${session.taskTitle}`);
    }
    parts.push(`Last activity: ${lastActivity}`);
    return parts.join('. ');
  }, [session, statusLabel, lastActivity]);

  return (
    <Pressable
      onPress={handlePress}
      onLongPress={handleLongPress}
      disabled={disabled}
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      accessibilityHint="Double tap to view terminal output. Long press for quick actions."
      accessibilityState={{ disabled, selected: isSelected }}
      testID={testID}
    >
      {({ pressed }) => (
        <Surface
          style={[
            styles.item,
            isSelected && styles.itemSelected,
            pressed && styles.itemPressed,
            disabled && styles.itemDisabled,
          ]}
          elevation={isSelected ? 2 : 1}
        >
          {/* Status indicator bar */}
          <View
            style={[styles.statusBar, { backgroundColor: statusColor }]}
            accessibilityElementsHidden
          />

          <View style={styles.content}>
            {/* Header row */}
            <View style={styles.header}>
              {/* Terminal icon */}
              <View style={[styles.iconContainer, { backgroundColor: `${statusColor}20` }]}>
                <Avatar.Icon
                  size={32}
                  icon={statusIcon}
                  style={styles.icon}
                  color={statusColor}
                />
                {/* Active indicator pulse */}
                {session.status === 'active' && (
                  <View style={styles.pulseIndicator} accessibilityElementsHidden />
                )}
              </View>

              {/* Title and status */}
              <View style={styles.titleContainer}>
                <View style={styles.titleRow}>
                  <Text
                    style={[styles.title, disabled && styles.textDisabled]}
                    numberOfLines={1}
                    ellipsizeMode="tail"
                    variant="titleSmall"
                  >
                    {session.name}
                  </Text>
                  <View
                    style={[styles.statusDot, { backgroundColor: statusColor }]}
                    accessibilityLabel={`Status: ${statusLabel}`}
                  />
                </View>

                {/* Current command */}
                {session.currentCommand && (
                  <Text style={styles.command} numberOfLines={1}>
                    $ {currentCommand}
                  </Text>
                )}

                {/* Task link */}
                {session.taskTitle && (
                  <View style={styles.taskLink}>
                    <Avatar.Icon
                      size={12}
                      icon="checkbox-marked-circle-outline"
                      style={styles.taskIcon}
                      color={colors.accent.primary}
                    />
                    <Text style={styles.taskText} numberOfLines={1}>
                      {session.taskTitle}
                    </Text>
                  </View>
                )}
              </View>

              {/* Line count badge */}
              <View style={styles.lineCountContainer}>
                <Text style={styles.lineCount}>{session.outputLineCount}</Text>
                <Text style={styles.lineCountLabel}>lines</Text>
              </View>
            </View>

            {/* Output preview */}
            {showPreview && outputPreview.length > 0 && (
              <View style={styles.previewContainer}>
                {outputPreview.map((line, index) => (
                  <Text key={index} style={styles.previewLine} numberOfLines={1}>
                    {line}
                  </Text>
                ))}
              </View>
            )}

            {/* Footer row */}
            <View style={styles.footer}>
              {/* Process info */}
              {session.process && (
                <View style={styles.processInfo}>
                  <Text style={styles.processText}>
                    PID: {session.process.pid}
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

              {/* Last activity */}
              <Text style={styles.timestamp}>{lastActivity}</Text>
            </View>

            {/* Error message if status is error */}
            {session.status === 'error' && (
              <View style={styles.errorContainer}>
                <Avatar.Icon
                  size={14}
                  icon="alert-circle"
                  style={styles.errorIcon}
                  color={colors.status.error}
                />
                <Text style={styles.errorText} numberOfLines={1}>
                  Terminal encountered an error
                </Text>
              </View>
            )}
          </View>
        </Surface>
      )}
    </Pressable>
  );
};

const styles = StyleSheet.create({
  item: {
    backgroundColor: colors.background.secondary,
    borderRadius: borderRadius.md,
    overflow: 'hidden',
    marginVertical: spacing.xs,
    marginHorizontal: spacing.sm,
    ...shadows.small,
  },
  itemSelected: {
    borderWidth: 1,
    borderColor: colors.accent.primary,
  },
  itemPressed: {
    opacity: 0.8,
  },
  itemDisabled: {
    opacity: 0.5,
  },
  statusBar: {
    height: 3,
    width: '100%',
  },
  content: {
    padding: spacing.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: {
    backgroundColor: 'transparent',
  },
  pulseIndicator: {
    position: 'absolute',
    top: -2,
    right: -2,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.status.success,
    borderWidth: 2,
    borderColor: colors.background.secondary,
  },
  titleContainer: {
    flex: 1,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  title: {
    color: colors.text.primary,
    fontWeight: '600',
    flex: 1,
  },
  textDisabled: {
    color: colors.text.disabled,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  command: {
    color: colors.accent.primary,
    fontSize: 12,
    fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace' }),
    marginTop: 4,
  },
  taskLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  taskIcon: {
    backgroundColor: 'transparent',
  },
  taskText: {
    color: colors.accent.primary,
    fontSize: 11,
    flex: 1,
  },
  lineCountContainer: {
    alignItems: 'center',
    backgroundColor: colors.surface.primary,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.sm,
  },
  lineCount: {
    color: colors.text.primary,
    fontSize: 14,
    fontWeight: '600',
  },
  lineCountLabel: {
    color: colors.text.muted,
    fontSize: 9,
  },
  previewContainer: {
    marginTop: spacing.sm,
    backgroundColor: colors.background.primary,
    borderRadius: borderRadius.sm,
    padding: spacing.sm,
    borderLeftWidth: 2,
    borderLeftColor: colors.surface.border,
  },
  previewLine: {
    color: colors.text.secondary,
    fontSize: 11,
    fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace' }),
    lineHeight: 16,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  processInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  processText: {
    color: colors.text.muted,
    fontSize: 11,
    fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace' }),
  },
  exitCode: {
    fontSize: 11,
    fontWeight: '500',
    fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace' }),
  },
  timestamp: {
    color: colors.text.muted,
    fontSize: 12,
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.sm,
    gap: 4,
    backgroundColor: colors.status.error + '15',
    padding: spacing.xs,
    borderRadius: borderRadius.sm,
  },
  errorIcon: {
    backgroundColor: 'transparent',
  },
  errorText: {
    color: colors.status.error,
    fontSize: 11,
    flex: 1,
  },
});

export default TerminalListItem;

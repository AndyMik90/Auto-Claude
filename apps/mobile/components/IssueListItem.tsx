/**
 * IssueListItem Component
 * Displays a GitHub issue in a list with state, labels, and action buttons
 * Supports onPress for navigation and action triggers for investigate/auto-fix
 */

import React, { useCallback, useMemo } from 'react';
import { StyleSheet, View, Pressable } from 'react-native';
import { Surface, Text, Chip, Avatar, IconButton } from 'react-native-paper';
import { useRouter } from 'expo-router';
import type { GitHubIssue, IssueState, GitHubLabel } from '../types';
import { colors, spacing, borderRadius, shadows } from '../theme';

/**
 * Props for the IssueListItem component
 */
interface IssueListItemProps {
  /** The issue to display */
  issue: GitHubIssue;
  /** Called when the item is pressed (navigation) */
  onPress?: (issue: GitHubIssue) => void;
  /** Called when the item is long-pressed (quick actions) */
  onLongPress?: (issue: GitHubIssue) => void;
  /** Called when investigate button is pressed */
  onInvestigate?: (issue: GitHubIssue) => void;
  /** Called when auto-fix button is pressed */
  onAutoFix?: (issue: GitHubIssue) => void;
  /** Whether action buttons are visible */
  showActions?: boolean;
  /** Whether the item is disabled */
  disabled?: boolean;
  /** Test ID for testing purposes */
  testID?: string;
}

/**
 * Get the color for an issue state
 */
const getStateColor = (state: IssueState): string => {
  const stateColors: Record<IssueState, string> = {
    open: colors.status.success,
    closed: colors.text.muted,
  };
  return stateColors[state] || colors.text.muted;
};

/**
 * Get icon for issue state
 */
const getStateIcon = (state: IssueState): string => {
  const icons: Record<IssueState, string> = {
    open: 'alert-circle-outline',
    closed: 'check-circle-outline',
  };
  return icons[state] || 'help-circle-outline';
};

/**
 * Format relative time from date string
 */
const formatRelativeTime = (dateString: string): string => {
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
 * Label chip component
 */
const LabelChip: React.FC<{ label: GitHubLabel }> = ({ label }) => {
  // Parse label color (GitHub colors are hex without #)
  const bgColor = label.color.startsWith('#') ? label.color : `#${label.color}`;
  // Calculate text color based on luminance
  const textColor = getLuminance(bgColor) > 0.5 ? colors.text.inverse : colors.text.primary;

  return (
    <View
      style={[styles.labelChip, { backgroundColor: bgColor }]}
      accessibilityLabel={`Label: ${label.name}`}
    >
      <Text style={[styles.labelText, { color: textColor }]} numberOfLines={1}>
        {label.name}
      </Text>
    </View>
  );
};

/**
 * Calculate luminance of a hex color
 */
const getLuminance = (hex: string): number => {
  const rgb = hexToRgb(hex);
  if (!rgb) return 0.5;
  const [r, g, b] = [rgb.r / 255, rgb.g / 255, rgb.b / 255].map((c) =>
    c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
  );
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

/**
 * Convert hex to RGB
 */
const hexToRgb = (hex: string): { r: number; g: number; b: number } | null => {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16),
      }
    : null;
};

/**
 * IssueListItem Component
 * A list item component for displaying GitHub issue information
 */
export const IssueListItem: React.FC<IssueListItemProps> = ({
  issue,
  onPress,
  onLongPress,
  onInvestigate,
  onAutoFix,
  showActions = true,
  disabled = false,
  testID,
}) => {
  const router = useRouter();

  // Memoize handlers
  const handlePress = useCallback(() => {
    if (!disabled) {
      if (onPress) {
        onPress(issue);
      } else {
        router.push(`/github/issue/${issue.id}` as any);
      }
    }
  }, [disabled, onPress, issue, router]);

  const handleLongPress = useCallback(() => {
    if (!disabled && onLongPress) {
      onLongPress(issue);
    }
  }, [disabled, onLongPress, issue]);

  const handleInvestigate = useCallback(() => {
    if (!disabled && onInvestigate) {
      onInvestigate(issue);
    }
  }, [disabled, onInvestigate, issue]);

  const handleAutoFix = useCallback(() => {
    if (!disabled && onAutoFix) {
      onAutoFix(issue);
    }
  }, [disabled, onAutoFix, issue]);

  // Memoize computed values
  const stateColor = useMemo(() => getStateColor(issue.state), [issue.state]);
  const stateIcon = useMemo(() => getStateIcon(issue.state), [issue.state]);
  const createdTime = useMemo(() => formatRelativeTime(issue.createdAt), [issue.createdAt]);

  // Generate accessibility label
  const accessibilityLabel = useMemo(() => {
    const parts = [
      `Issue ${issue.number}: ${issue.title}`,
      `State: ${issue.state}`,
      `${issue.commentCount} comments`,
    ];
    if (issue.labels.length > 0) {
      parts.push(`Labels: ${issue.labels.map((l) => l.name).join(', ')}`);
    }
    if (issue.assignees && issue.assignees.length > 0) {
      parts.push(`Assignees: ${issue.assignees.map((a) => a.login).join(', ')}`);
    }
    parts.push(`Created ${createdTime}`);
    return parts.join('. ');
  }, [issue, createdTime]);

  return (
    <Pressable
      onPress={handlePress}
      onLongPress={handleLongPress}
      disabled={disabled}
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      accessibilityHint="Double tap to view issue details. Long press for quick actions."
      accessibilityState={{ disabled }}
      testID={testID}
    >
      {({ pressed }) => (
        <Surface
          style={[
            styles.item,
            pressed && styles.itemPressed,
            disabled && styles.itemDisabled,
          ]}
          elevation={1}
        >
          {/* State indicator bar */}
          <View
            style={[styles.stateBar, { backgroundColor: stateColor }]}
            accessibilityElementsHidden
          />

          <View style={styles.content}>
            {/* Header row */}
            <View style={styles.header}>
              {/* State icon */}
              <Avatar.Icon
                size={36}
                icon={stateIcon}
                style={[styles.stateIcon, { backgroundColor: `${stateColor}20` }]}
                color={stateColor}
              />

              {/* Title and meta */}
              <View style={styles.titleContainer}>
                <View style={styles.titleRow}>
                  <Text
                    style={[styles.issueNumber, { color: stateColor }]}
                    variant="labelMedium"
                  >
                    #{issue.number}
                  </Text>
                  <Text
                    style={[styles.title, disabled && styles.textDisabled]}
                    numberOfLines={2}
                    ellipsizeMode="tail"
                    variant="titleSmall"
                  >
                    {issue.title}
                  </Text>
                </View>
                <Text style={styles.meta}>
                  opened {createdTime} by {issue.author.login}
                </Text>
              </View>
            </View>

            {/* Labels row */}
            {issue.labels.length > 0 && (
              <View style={styles.labelsRow}>
                {issue.labels.slice(0, 3).map((label) => (
                  <LabelChip key={label.id} label={label} />
                ))}
                {issue.labels.length > 3 && (
                  <Text style={styles.moreLabels}>+{issue.labels.length - 3}</Text>
                )}
              </View>
            )}

            {/* Footer row */}
            <View style={styles.footer}>
              {/* Stats */}
              <View style={styles.stats}>
                {/* Comments */}
                <View style={styles.statItem} accessibilityLabel={`${issue.commentCount} comments`}>
                  <Avatar.Icon
                    size={16}
                    icon="comment-outline"
                    style={styles.statIcon}
                    color={colors.text.muted}
                  />
                  <Text style={styles.statText}>{issue.commentCount}</Text>
                </View>

                {/* Assignees */}
                {issue.assignees && issue.assignees.length > 0 && (
                  <View style={styles.assigneesContainer}>
                    {issue.assignees.slice(0, 3).map((assignee, index) => (
                      <Avatar.Text
                        key={assignee.id}
                        size={20}
                        label={assignee.login.substring(0, 2).toUpperCase()}
                        style={[
                          styles.assigneeAvatar,
                          { marginLeft: index > 0 ? -6 : 0 },
                        ]}
                        labelStyle={styles.assigneeLabel}
                        accessibilityLabel={`Assigned to ${assignee.login}`}
                      />
                    ))}
                    {issue.assignees.length > 3 && (
                      <Text style={styles.moreAssignees}>+{issue.assignees.length - 3}</Text>
                    )}
                  </View>
                )}
              </View>

              {/* Action buttons */}
              {showActions && issue.state === 'open' && (
                <View style={styles.actions}>
                  {/* Investigation indicator */}
                  {issue.isInvestigating && (
                    <Chip
                      mode="flat"
                      icon="magnify"
                      style={styles.actionChip}
                      textStyle={styles.actionChipText}
                      compact
                      accessibilityLabel="AI investigation in progress"
                      accessibilityRole="progressbar"
                    >
                      Investigating
                    </Chip>
                  )}
                  {issue.isAutoFixing && (
                    <Chip
                      mode="flat"
                      icon="wrench"
                      style={styles.actionChip}
                      textStyle={styles.actionChipText}
                      compact
                      accessibilityLabel="AI auto-fix in progress"
                      accessibilityRole="progressbar"
                    >
                      Fixing
                    </Chip>
                  )}

                  {/* Action buttons (only show when not already in progress) */}
                  {!issue.isInvestigating && !issue.isAutoFixing && (
                    <>
                      <IconButton
                        icon="magnify"
                        size={18}
                        onPress={handleInvestigate}
                        disabled={disabled}
                        style={styles.actionButton}
                        iconColor={colors.status.info}
                        accessibilityLabel="Investigate issue"
                        accessibilityHint="Start AI investigation of this issue"
                      />
                      <IconButton
                        icon="wrench"
                        size={18}
                        onPress={handleAutoFix}
                        disabled={disabled}
                        style={styles.actionButton}
                        iconColor={colors.accent.primary}
                        accessibilityLabel="Auto-fix issue"
                        accessibilityHint="Start AI auto-fix for this issue"
                      />
                    </>
                  )}
                </View>
              )}
            </View>

            {/* Linked task indicator */}
            {issue.linkedTaskId && (
              <View
                style={styles.linkedTask}
                accessibilityLabel="This issue is linked to a task"
                accessibilityRole="text"
              >
                <Avatar.Icon
                  size={14}
                  icon="link"
                  style={styles.linkedIcon}
                  color={colors.accent.primary}
                />
                <Text style={styles.linkedText}>Linked to task</Text>
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
  itemPressed: {
    opacity: 0.8,
  },
  itemDisabled: {
    opacity: 0.5,
  },
  stateBar: {
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
  stateIcon: {
    backgroundColor: colors.surface.primary,
  },
  titleContainer: {
    flex: 1,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.xs,
  },
  issueNumber: {
    fontWeight: '600',
  },
  title: {
    color: colors.text.primary,
    fontWeight: '500',
    flex: 1,
    lineHeight: 20,
  },
  textDisabled: {
    color: colors.text.disabled,
  },
  meta: {
    color: colors.text.muted,
    fontSize: 12,
    marginTop: 4,
  },
  labelsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginTop: spacing.sm,
  },
  labelChip: {
    paddingHorizontal: spacing.xs,
    paddingVertical: 2,
    borderRadius: borderRadius.round,
    maxWidth: 100,
  },
  labelText: {
    fontSize: 10,
    fontWeight: '500',
  },
  moreLabels: {
    color: colors.text.muted,
    fontSize: 11,
    marginLeft: 4,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  stats: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  statIcon: {
    backgroundColor: 'transparent',
  },
  statText: {
    color: colors.text.muted,
    fontSize: 12,
  },
  assigneesContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  assigneeAvatar: {
    backgroundColor: colors.surface.border,
    borderWidth: 1,
    borderColor: colors.background.secondary,
  },
  assigneeLabel: {
    fontSize: 8,
    color: colors.text.secondary,
  },
  moreAssignees: {
    color: colors.text.muted,
    fontSize: 10,
    marginLeft: 4,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  actionChip: {
    backgroundColor: colors.accent.primary + '20',
    height: 24,
  },
  actionChipText: {
    color: colors.accent.primary,
    fontSize: 10,
  },
  actionButton: {
    margin: 0,
  },
  linkedTask: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.sm,
    gap: 4,
  },
  linkedIcon: {
    backgroundColor: 'transparent',
  },
  linkedText: {
    color: colors.accent.primary,
    fontSize: 11,
  },
});

export default IssueListItem;

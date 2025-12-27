/**
 * PRListItem Component
 * Displays a GitHub pull request in a list with state, reviews, checks, and action buttons
 * Supports onPress for navigation and action triggers for investigate/auto-fix
 */

import React, { useCallback, useMemo } from 'react';
import { StyleSheet, View, Pressable } from 'react-native';
import { Surface, Text, Chip, Avatar, IconButton } from 'react-native-paper';
import { useRouter } from 'expo-router';
import type { GitHubPR, PRState, GitHubLabel } from '../types';
import { colors, spacing, borderRadius, shadows } from '../theme';

/**
 * Props for the PRListItem component
 */
interface PRListItemProps {
  /** The pull request to display */
  pr: GitHubPR;
  /** Called when the item is pressed (navigation) */
  onPress?: (pr: GitHubPR) => void;
  /** Called when the item is long-pressed (quick actions) */
  onLongPress?: (pr: GitHubPR) => void;
  /** Called when investigate button is pressed */
  onInvestigate?: (pr: GitHubPR) => void;
  /** Called when auto-fix button is pressed */
  onAutoFix?: (pr: GitHubPR) => void;
  /** Whether action buttons are visible */
  showActions?: boolean;
  /** Whether the item is disabled */
  disabled?: boolean;
  /** Test ID for testing purposes */
  testID?: string;
}

/**
 * Get the color for a PR state
 */
const getStateColor = (state: PRState, isDraft: boolean): string => {
  if (isDraft) return colors.text.muted;
  const stateColors: Record<PRState, string> = {
    open: colors.status.success,
    closed: colors.status.error,
    merged: colors.taskStatus.ai_review, // Purple for merged
  };
  return stateColors[state] || colors.text.muted;
};

/**
 * Get icon for PR state
 */
const getStateIcon = (state: PRState, isDraft: boolean): string => {
  if (isDraft) return 'source-pull';
  const icons: Record<PRState, string> = {
    open: 'source-pull',
    closed: 'source-pull',
    merged: 'source-merge',
  };
  return icons[state] || 'source-pull';
};

/**
 * Get display label for PR state
 */
const getStateLabel = (state: PRState, isDraft: boolean): string => {
  if (isDraft) return 'Draft';
  const labels: Record<PRState, string> = {
    open: 'Open',
    closed: 'Closed',
    merged: 'Merged',
  };
  return labels[state] || state;
};

/**
 * Get color for check status
 */
const getChecksColor = (status: GitHubPR['checksStatus']): string => {
  const statusColors = {
    pending: colors.status.warning,
    success: colors.status.success,
    failure: colors.status.error,
    neutral: colors.text.muted,
  };
  return statusColors[status] || colors.text.muted;
};

/**
 * Get icon for check status
 */
const getChecksIcon = (status: GitHubPR['checksStatus']): string => {
  const icons = {
    pending: 'clock-outline',
    success: 'check-circle',
    failure: 'close-circle',
    neutral: 'minus-circle',
  };
  return icons[status] || 'help-circle';
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
  const bgColor = label.color.startsWith('#') ? label.color : `#${label.color}`;
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
 * PRListItem Component
 * A list item component for displaying GitHub pull request information
 */
export const PRListItem: React.FC<PRListItemProps> = ({
  pr,
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
        onPress(pr);
      } else {
        router.push(`/github/pr/${pr.id}`);
      }
    }
  }, [disabled, onPress, pr, router]);

  const handleLongPress = useCallback(() => {
    if (!disabled && onLongPress) {
      onLongPress(pr);
    }
  }, [disabled, onLongPress, pr]);

  const handleInvestigate = useCallback(() => {
    if (!disabled && onInvestigate) {
      onInvestigate(pr);
    }
  }, [disabled, onInvestigate, pr]);

  const handleAutoFix = useCallback(() => {
    if (!disabled && onAutoFix) {
      onAutoFix(pr);
    }
  }, [disabled, onAutoFix, pr]);

  // Memoize computed values
  const stateColor = useMemo(() => getStateColor(pr.state, pr.isDraft), [pr.state, pr.isDraft]);
  const stateIcon = useMemo(() => getStateIcon(pr.state, pr.isDraft), [pr.state, pr.isDraft]);
  const stateLabel = useMemo(() => getStateLabel(pr.state, pr.isDraft), [pr.state, pr.isDraft]);
  const checksColor = useMemo(() => getChecksColor(pr.checksStatus), [pr.checksStatus]);
  const checksIcon = useMemo(() => getChecksIcon(pr.checksStatus), [pr.checksStatus]);
  const createdTime = useMemo(() => formatRelativeTime(pr.createdAt), [pr.createdAt]);

  // Review summary
  const reviewSummary = useMemo(() => {
    const approved = pr.reviews.filter((r) => r.state === 'approved').length;
    const changesRequested = pr.reviews.filter((r) => r.state === 'changes_requested').length;
    return { approved, changesRequested };
  }, [pr.reviews]);

  // Generate accessibility label
  const accessibilityLabel = useMemo(() => {
    const parts = [
      `Pull request ${pr.number}: ${pr.title}`,
      `State: ${stateLabel}`,
      `Checks: ${pr.checksStatus}`,
      `${reviewSummary.approved} approvals, ${reviewSummary.changesRequested} changes requested`,
      `${pr.additions} additions, ${pr.deletions} deletions in ${pr.changedFiles} files`,
    ];
    if (pr.labels.length > 0) {
      parts.push(`Labels: ${pr.labels.map((l) => l.name).join(', ')}`);
    }
    parts.push(`Created ${createdTime}`);
    return parts.join('. ');
  }, [pr, stateLabel, reviewSummary, createdTime]);

  return (
    <Pressable
      onPress={handlePress}
      onLongPress={handleLongPress}
      disabled={disabled}
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      accessibilityHint="Double tap to view pull request details. Long press for quick actions."
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
                    style={[styles.prNumber, { color: stateColor }]}
                    variant="labelMedium"
                  >
                    #{pr.number}
                  </Text>
                  {pr.isDraft && (
                    <Chip
                      mode="flat"
                      style={styles.draftChip}
                      textStyle={styles.draftChipText}
                      compact
                      accessibilityLabel="Draft pull request"
                    >
                      Draft
                    </Chip>
                  )}
                </View>
                <Text
                  style={[styles.title, disabled && styles.textDisabled]}
                  numberOfLines={2}
                  ellipsizeMode="tail"
                  variant="titleSmall"
                >
                  {pr.title}
                </Text>
                <Text style={styles.meta}>
                  {pr.headBranch} → {pr.baseBranch}
                </Text>
              </View>
            </View>

            {/* Branch and stats row */}
            <View style={styles.statsRow}>
              {/* Checks status */}
              <View style={styles.checksContainer}>
                <Avatar.Icon
                  size={18}
                  icon={checksIcon}
                  style={[styles.checksIcon, { backgroundColor: 'transparent' }]}
                  color={checksColor}
                />
                <Text style={[styles.checksText, { color: checksColor }]}>
                  {pr.checks.length} checks
                </Text>
              </View>

              {/* Reviews */}
              <View style={styles.reviewsContainer}>
                {reviewSummary.approved > 0 && (
                  <View style={styles.reviewItem}>
                    <Avatar.Icon
                      size={16}
                      icon="check"
                      style={styles.reviewIcon}
                      color={colors.status.success}
                    />
                    <Text style={[styles.reviewText, { color: colors.status.success }]}>
                      {reviewSummary.approved}
                    </Text>
                  </View>
                )}
                {reviewSummary.changesRequested > 0 && (
                  <View style={styles.reviewItem}>
                    <Avatar.Icon
                      size={16}
                      icon="close"
                      style={styles.reviewIcon}
                      color={colors.status.error}
                    />
                    <Text style={[styles.reviewText, { color: colors.status.error }]}>
                      {reviewSummary.changesRequested}
                    </Text>
                  </View>
                )}
              </View>

              {/* Diff stats */}
              <View style={styles.diffStats}>
                <Text style={styles.additions}>+{pr.additions}</Text>
                <Text style={styles.deletions}>-{pr.deletions}</Text>
              </View>
            </View>

            {/* Labels row */}
            {pr.labels.length > 0 && (
              <View style={styles.labelsRow}>
                {pr.labels.slice(0, 3).map((label) => (
                  <LabelChip key={label.id} label={label} />
                ))}
                {pr.labels.length > 3 && (
                  <Text style={styles.moreLabels}>+{pr.labels.length - 3}</Text>
                )}
              </View>
            )}

            {/* Footer row */}
            <View style={styles.footer}>
              {/* Meta info */}
              <View style={styles.footerMeta}>
                <Text style={styles.timestamp}>{createdTime}</Text>
                <Text style={styles.separator}>•</Text>
                <Text style={styles.filesCount}>{pr.changedFiles} files</Text>
              </View>

              {/* Action buttons */}
              {showActions && pr.state === 'open' && (
                <View style={styles.actions}>
                  {/* Investigation indicator */}
                  {pr.isInvestigating && (
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
                  {pr.isAutoFixing && (
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

                  {/* Action buttons */}
                  {!pr.isInvestigating && !pr.isAutoFixing && (
                    <>
                      <IconButton
                        icon="magnify"
                        size={18}
                        onPress={handleInvestigate}
                        disabled={disabled}
                        style={styles.actionButton}
                        iconColor={colors.status.info}
                        accessibilityLabel="Investigate PR"
                        accessibilityHint="Start AI investigation of this pull request"
                      />
                      <IconButton
                        icon="wrench"
                        size={18}
                        onPress={handleAutoFix}
                        disabled={disabled}
                        style={styles.actionButton}
                        iconColor={colors.accent.primary}
                        accessibilityLabel="Auto-fix PR"
                        accessibilityHint="Start AI auto-fix for this pull request"
                      />
                    </>
                  )}
                </View>
              )}
            </View>

            {/* Merge status */}
            {pr.state === 'open' && (
              <View
                style={styles.mergeStatus}
                accessibilityLabel={`Merge status: ${
                  pr.mergeableState === 'conflicting'
                    ? 'Has conflicts'
                    : pr.mergeable
                    ? 'Ready to merge'
                    : 'Cannot merge'
                }`}
                accessibilityRole="text"
              >
                <Avatar.Icon
                  size={14}
                  icon={pr.mergeable ? 'check-circle' : 'alert-circle'}
                  style={styles.mergeIcon}
                  color={pr.mergeable ? colors.status.success : colors.status.warning}
                />
                <Text
                  style={[
                    styles.mergeText,
                    { color: pr.mergeable ? colors.status.success : colors.status.warning },
                  ]}
                >
                  {pr.mergeableState === 'conflicting'
                    ? 'Has conflicts'
                    : pr.mergeable
                    ? 'Ready to merge'
                    : 'Cannot merge'}
                </Text>
              </View>
            )}

            {/* Linked task indicator */}
            {pr.linkedTaskId && (
              <View
                style={styles.linkedTask}
                accessibilityLabel="This pull request is linked to a task"
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
    alignItems: 'center',
    gap: spacing.xs,
  },
  prNumber: {
    fontWeight: '600',
  },
  draftChip: {
    backgroundColor: colors.surface.border,
    height: 20,
  },
  draftChipText: {
    color: colors.text.muted,
    fontSize: 9,
  },
  title: {
    color: colors.text.primary,
    fontWeight: '500',
    lineHeight: 20,
    marginTop: 4,
  },
  textDisabled: {
    color: colors.text.disabled,
  },
  meta: {
    color: colors.text.muted,
    fontSize: 11,
    marginTop: 4,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.sm,
    gap: spacing.md,
  },
  checksContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  checksIcon: {},
  checksText: {
    fontSize: 12,
    fontWeight: '500',
  },
  reviewsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  reviewItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  reviewIcon: {
    backgroundColor: 'transparent',
  },
  reviewText: {
    fontSize: 12,
    fontWeight: '500',
  },
  diffStats: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginLeft: 'auto',
  },
  additions: {
    color: colors.status.success,
    fontSize: 11,
    fontWeight: '600',
  },
  deletions: {
    color: colors.status.error,
    fontSize: 11,
    fontWeight: '600',
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
  footerMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  timestamp: {
    color: colors.text.muted,
    fontSize: 12,
  },
  separator: {
    color: colors.text.muted,
    fontSize: 12,
  },
  filesCount: {
    color: colors.text.muted,
    fontSize: 12,
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
  mergeStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.sm,
    gap: 4,
  },
  mergeIcon: {
    backgroundColor: 'transparent',
  },
  mergeText: {
    fontSize: 11,
    fontWeight: '500',
  },
  linkedTask: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.xs,
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

export default PRListItem;

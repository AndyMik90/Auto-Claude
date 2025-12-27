/**
 * GitHub PR Detail Screen
 * Displays detailed information about a specific pull request
 * Includes description, reviews, checks, diff stats, and action buttons
 */

import React, { useCallback, useMemo } from 'react';
import { StyleSheet, View, ScrollView, Linking } from 'react-native';
import {
  Surface,
  Text,
  Avatar,
  Chip,
  Button,
  Divider,
  IconButton,
  ActivityIndicator,
  ProgressBar,
} from 'react-native-paper';
import { useLocalSearchParams, Stack, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useGitHubStore } from '../../../stores/githubStore';
import type { GitHubLabel, PRState, GitHubPR } from '../../../types';
import { colors, spacing, borderRadius, shadows } from '../../../theme';
import { EmptyState } from '../../../components';

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

  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins} minutes ago`;
  if (diffHours < 24) return `${diffHours} hours ago`;
  if (diffDays < 7) return `${diffDays} days ago`;
  return date.toLocaleDateString();
};

/**
 * Calculate luminance of a hex color
 */
const getLuminance = (hex: string): number => {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return 0.5;
  const [r, g, b] = [
    parseInt(result[1], 16) / 255,
    parseInt(result[2], 16) / 255,
    parseInt(result[3], 16) / 255,
  ].map((c) => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
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
      <Text style={[styles.labelText, { color: textColor }]}>{label.name}</Text>
    </View>
  );
};

/**
 * GitHub PR detail screen
 * Displays detailed information about a specific pull request
 */
export default function PRDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  // Get PR from store
  const getPRById = useGitHubStore((state) => state.getPRById);
  const investigatePR = useGitHubStore((state) => state.investigatePR);
  const stopPRInvestigation = useGitHubStore((state) => state.stopPRInvestigation);
  const updatePR = useGitHubStore((state) => state.updatePR);

  const pr = useMemo(() => (id ? getPRById(id) : undefined), [id, getPRById]);

  // Computed values
  const stateColor = useMemo(
    () => (pr ? getStateColor(pr.state, pr.isDraft) : colors.text.muted),
    [pr]
  );
  const stateIcon = useMemo(
    () => (pr ? getStateIcon(pr.state, pr.isDraft) : 'source-pull'),
    [pr]
  );
  const stateLabel = useMemo(
    () => (pr ? getStateLabel(pr.state, pr.isDraft) : 'Unknown'),
    [pr]
  );
  const checksColor = useMemo(
    () => (pr ? getChecksColor(pr.checksStatus) : colors.text.muted),
    [pr]
  );
  const checksIcon = useMemo(
    () => (pr ? getChecksIcon(pr.checksStatus) : 'help-circle'),
    [pr]
  );
  const createdTime = useMemo(
    () => (pr ? formatRelativeTime(pr.createdAt) : ''),
    [pr]
  );
  const updatedTime = useMemo(
    () => (pr ? formatRelativeTime(pr.updatedAt) : ''),
    [pr]
  );

  // Review summary
  const reviewSummary = useMemo(() => {
    if (!pr) return { approved: 0, changesRequested: 0, commented: 0 };
    return {
      approved: pr.reviews.filter((r) => r.state === 'approved').length,
      changesRequested: pr.reviews.filter((r) => r.state === 'changes_requested').length,
      commented: pr.reviews.filter((r) => r.state === 'commented').length,
    };
  }, [pr]);

  // Handlers
  const handleInvestigate = useCallback(() => {
    if (!pr) return;
    if (pr.isInvestigating) {
      stopPRInvestigation(pr.id);
    } else {
      investigatePR(pr.id);
    }
  }, [pr, investigatePR, stopPRInvestigation]);

  const handleAutoFix = useCallback(() => {
    if (!pr) return;
    // Toggle auto-fix state
    updatePR(pr.id, { isAutoFixing: !pr.isAutoFixing });
  }, [pr, updatePR]);

  const handleOpenInGitHub = useCallback(() => {
    if (pr?.htmlUrl) {
      Linking.openURL(pr.htmlUrl);
    }
  }, [pr]);

  const handleViewLinkedTask = useCallback(() => {
    if (pr?.linkedTaskId) {
      router.push(`/task/${pr.linkedTaskId}`);
    }
  }, [pr, router]);

  // If PR not found
  if (!pr) {
    return (
      <>
        <Stack.Screen
          options={{
            title: 'PR Not Found',
            headerStyle: { backgroundColor: colors.background.secondary },
            headerTintColor: colors.text.primary,
            headerShadowVisible: false,
          }}
        />
        <View style={styles.container}>
          <EmptyState
            icon="source-pull"
            title="Pull Request Not Found"
            description="The pull request you're looking for doesn't exist or has been removed."
          />
        </View>
      </>
    );
  }

  return (
    <>
      <Stack.Screen
        options={{
          title: `#${pr.number}`,
          headerStyle: { backgroundColor: colors.background.secondary },
          headerTintColor: colors.text.primary,
          headerShadowVisible: false,
          headerRight: () => (
            <IconButton
              icon="open-in-new"
              size={20}
              iconColor={colors.text.secondary}
              onPress={handleOpenInGitHub}
              accessibilityLabel="Open in GitHub"
            />
          ),
        }}
      />
      <ScrollView
        style={styles.container}
        contentContainerStyle={[
          styles.content,
          { paddingBottom: insets.bottom + spacing.lg },
        ]}
      >
        {/* Header Card */}
        <Surface style={styles.headerCard} elevation={1}>
          {/* State indicator bar */}
          <View
            style={[styles.stateBar, { backgroundColor: stateColor }]}
            accessibilityElementsHidden
          />

          <View style={styles.headerContent}>
            {/* State badge and number */}
            <View style={styles.stateRow}>
              <Chip
                mode="flat"
                icon={stateIcon}
                style={[styles.stateChip, { backgroundColor: `${stateColor}20` }]}
                textStyle={[styles.stateChipText, { color: stateColor }]}
              >
                {stateLabel}
              </Chip>
              {pr.isDraft && (
                <Chip
                  mode="flat"
                  style={styles.draftChip}
                  textStyle={styles.draftChipText}
                >
                  Draft
                </Chip>
              )}
              <Text style={styles.prNumber}>#{pr.number}</Text>
            </View>

            {/* Title */}
            <Text variant="headlineSmall" style={styles.title}>
              {pr.title}
            </Text>

            {/* Branch info */}
            <View style={styles.branchRow}>
              <Icon name="source-branch" size={16} color={colors.text.muted} />
              <Text style={styles.branchText}>
                {pr.headBranch} → {pr.baseBranch}
              </Text>
            </View>

            {/* Meta info */}
            <View style={styles.metaRow}>
              <Avatar.Text
                size={24}
                label={pr.author.login.substring(0, 2).toUpperCase()}
                style={styles.authorAvatar}
                labelStyle={styles.authorLabel}
              />
              <Text style={styles.metaText}>
                {pr.author.login} opened {createdTime}
              </Text>
            </View>
          </View>
        </Surface>

        {/* Checks Section */}
        <Surface style={styles.section} elevation={1}>
          <View style={styles.checksHeader}>
            <Text variant="titleSmall" style={styles.sectionTitle}>
              Checks
            </Text>
            <View style={styles.checksStatus}>
              <Icon name={checksIcon} size={20} color={checksColor} />
              <Text style={[styles.checksStatusText, { color: checksColor }]}>
                {pr.checks.filter((c) => c.conclusion === 'success').length}/
                {pr.checks.length} passing
              </Text>
            </View>
          </View>
          <View style={styles.checksList}>
            {pr.checks.map((check) => (
              <View key={check.id} style={styles.checkItem}>
                <Icon
                  name={
                    check.status === 'completed'
                      ? check.conclusion === 'success'
                        ? 'check-circle'
                        : 'close-circle'
                      : 'clock-outline'
                  }
                  size={16}
                  color={
                    check.status === 'completed'
                      ? check.conclusion === 'success'
                        ? colors.status.success
                        : colors.status.error
                      : colors.status.warning
                  }
                />
                <Text style={styles.checkName}>{check.name}</Text>
                <Text style={styles.checkStatus}>
                  {check.status === 'completed' ? check.conclusion : check.status}
                </Text>
              </View>
            ))}
          </View>
        </Surface>

        {/* Reviews Section */}
        <Surface style={styles.section} elevation={1}>
          <Text variant="titleSmall" style={styles.sectionTitle}>
            Reviews
          </Text>
          <View style={styles.reviewsSummary}>
            {reviewSummary.approved > 0 && (
              <View style={styles.reviewSummaryItem}>
                <Icon name="check" size={18} color={colors.status.success} />
                <Text style={[styles.reviewSummaryText, { color: colors.status.success }]}>
                  {reviewSummary.approved} approved
                </Text>
              </View>
            )}
            {reviewSummary.changesRequested > 0 && (
              <View style={styles.reviewSummaryItem}>
                <Icon name="close" size={18} color={colors.status.error} />
                <Text style={[styles.reviewSummaryText, { color: colors.status.error }]}>
                  {reviewSummary.changesRequested} changes requested
                </Text>
              </View>
            )}
            {reviewSummary.commented > 0 && (
              <View style={styles.reviewSummaryItem}>
                <Icon name="comment-text-outline" size={18} color={colors.text.muted} />
                <Text style={styles.reviewSummaryText}>
                  {reviewSummary.commented} commented
                </Text>
              </View>
            )}
            {pr.reviews.length === 0 && (
              <Text style={styles.noReviews}>No reviews yet</Text>
            )}
          </View>
          {pr.reviews.length > 0 && (
            <View style={styles.reviewsList}>
              {pr.reviews.map((review) => (
                <View key={review.id} style={styles.reviewItem}>
                  <Avatar.Text
                    size={28}
                    label={review.author.login.substring(0, 2).toUpperCase()}
                    style={styles.reviewerAvatar}
                    labelStyle={styles.reviewerLabel}
                  />
                  <View style={styles.reviewContent}>
                    <View style={styles.reviewHeader}>
                      <Text style={styles.reviewerName}>{review.author.login}</Text>
                      <Chip
                        mode="flat"
                        style={[
                          styles.reviewStateChip,
                          {
                            backgroundColor:
                              review.state === 'approved'
                                ? colors.status.success + '20'
                                : review.state === 'changes_requested'
                                ? colors.status.error + '20'
                                : colors.surface.primary,
                          },
                        ]}
                        textStyle={[
                          styles.reviewStateText,
                          {
                            color:
                              review.state === 'approved'
                                ? colors.status.success
                                : review.state === 'changes_requested'
                                ? colors.status.error
                                : colors.text.muted,
                          },
                        ]}
                        compact
                      >
                        {review.state === 'approved'
                          ? 'Approved'
                          : review.state === 'changes_requested'
                          ? 'Changes'
                          : 'Commented'}
                      </Chip>
                    </View>
                    {review.body && (
                      <Text style={styles.reviewBody} numberOfLines={2}>
                        {review.body}
                      </Text>
                    )}
                  </View>
                </View>
              ))}
            </View>
          )}
        </Surface>

        {/* Diff Stats Section */}
        <Surface style={styles.section} elevation={1}>
          <Text variant="titleSmall" style={styles.sectionTitle}>
            Changes
          </Text>
          <View style={styles.diffStats}>
            <View style={styles.diffStatItem}>
              <Text style={styles.diffAdditions}>+{pr.additions}</Text>
              <Text style={styles.diffLabel}>additions</Text>
            </View>
            <View style={styles.diffStatItem}>
              <Text style={styles.diffDeletions}>-{pr.deletions}</Text>
              <Text style={styles.diffLabel}>deletions</Text>
            </View>
            <View style={styles.diffStatItem}>
              <Text style={styles.diffFiles}>{pr.changedFiles}</Text>
              <Text style={styles.diffLabel}>files</Text>
            </View>
          </View>
          <View style={styles.diffBar}>
            <View
              style={[
                styles.diffBarAdditions,
                {
                  flex: pr.additions / (pr.additions + pr.deletions) || 0.5,
                },
              ]}
            />
            <View
              style={[
                styles.diffBarDeletions,
                {
                  flex: pr.deletions / (pr.additions + pr.deletions) || 0.5,
                },
              ]}
            />
          </View>
        </Surface>

        {/* Labels Section */}
        {pr.labels.length > 0 && (
          <Surface style={styles.section} elevation={1}>
            <Text variant="titleSmall" style={styles.sectionTitle}>
              Labels
            </Text>
            <View style={styles.labelsContainer}>
              {pr.labels.map((label) => (
                <LabelChip key={label.id} label={label} />
              ))}
            </View>
          </Surface>
        )}

        {/* Description Section */}
        <Surface style={styles.section} elevation={1}>
          <Text variant="titleSmall" style={styles.sectionTitle}>
            Description
          </Text>
          <Text style={styles.bodyText}>
            {pr.body || 'No description provided.'}
          </Text>
        </Surface>

        {/* Merge Status */}
        {pr.state === 'open' && (
          <Surface style={styles.section} elevation={1}>
            <View style={styles.mergeStatusRow}>
              <Icon
                name={pr.mergeable ? 'check-circle' : 'alert-circle'}
                size={24}
                color={
                  pr.mergeableState === 'conflicting'
                    ? colors.status.error
                    : pr.mergeable
                    ? colors.status.success
                    : colors.status.warning
                }
              />
              <View style={styles.mergeStatusContent}>
                <Text
                  style={[
                    styles.mergeStatusTitle,
                    {
                      color:
                        pr.mergeableState === 'conflicting'
                          ? colors.status.error
                          : pr.mergeable
                          ? colors.status.success
                          : colors.status.warning,
                    },
                  ]}
                >
                  {pr.mergeableState === 'conflicting'
                    ? 'Has conflicts'
                    : pr.mergeable
                    ? 'Ready to merge'
                    : 'Cannot merge'}
                </Text>
                <Text style={styles.mergeStatusDescription}>
                  {pr.mergeableState === 'conflicting'
                    ? 'This branch has conflicts that must be resolved.'
                    : pr.mergeable
                    ? 'All checks have passed and there are no conflicts.'
                    : 'Merging is blocked.'}
                </Text>
              </View>
            </View>
          </Surface>
        )}

        {/* Linked Task Section */}
        {pr.linkedTaskId && (
          <Surface style={styles.section} elevation={1}>
            <View style={styles.linkedTaskRow}>
              <View style={styles.linkedTaskInfo}>
                <Icon name="link" size={20} color={colors.accent.primary} />
                <Text style={styles.linkedTaskText}>Linked to Task</Text>
              </View>
              <Button
                mode="text"
                onPress={handleViewLinkedTask}
                textColor={colors.accent.primary}
                compact
              >
                View Task
              </Button>
            </View>
          </Surface>
        )}

        {/* Action Buttons */}
        {pr.state === 'open' && (
          <View style={styles.actionsContainer}>
            <Button
              mode={pr.isInvestigating ? 'contained' : 'outlined'}
              onPress={handleInvestigate}
              icon={pr.isInvestigating ? 'stop' : 'magnify'}
              style={styles.actionButton}
              buttonColor={pr.isInvestigating ? colors.status.info : undefined}
              textColor={pr.isInvestigating ? colors.text.primary : colors.status.info}
              accessibilityLabel={
                pr.isInvestigating ? 'Stop investigation' : 'Investigate PR'
              }
            >
              {pr.isInvestigating ? 'Stop Investigating' : 'Investigate'}
            </Button>

            <Button
              mode={pr.isAutoFixing ? 'contained' : 'outlined'}
              onPress={handleAutoFix}
              icon={pr.isAutoFixing ? 'stop' : 'wrench'}
              style={styles.actionButton}
              buttonColor={pr.isAutoFixing ? colors.accent.primary : undefined}
              textColor={pr.isAutoFixing ? colors.text.inverse : colors.accent.primary}
              accessibilityLabel={pr.isAutoFixing ? 'Stop auto-fix' : 'Auto-fix PR'}
            >
              {pr.isAutoFixing ? 'Stop Auto-fix' : 'Auto-fix'}
            </Button>
          </View>
        )}

        {/* Status Indicators */}
        {(pr.isInvestigating || pr.isAutoFixing) && (
          <Surface style={styles.statusCard} elevation={1}>
            {pr.isInvestigating && (
              <View style={styles.statusRow}>
                <ActivityIndicator size={16} color={colors.status.info} />
                <Text style={styles.statusText}>
                  Claude is investigating this pull request...
                </Text>
              </View>
            )}
            {pr.isAutoFixing && (
              <View style={styles.statusRow}>
                <ActivityIndicator size={16} color={colors.accent.primary} />
                <Text style={styles.statusText}>
                  Claude is working on improvements...
                </Text>
              </View>
            )}
          </Surface>
        )}

        {/* Repository Info */}
        <Surface style={styles.section} elevation={1}>
          <View style={styles.repoRow}>
            <Icon name="source-repository" size={20} color={colors.text.muted} />
            <Text style={styles.repoText}>
              {pr.repositoryOwner}/{pr.repositoryName}
            </Text>
          </View>
        </Surface>
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.primary,
  },
  content: {
    padding: spacing.md,
    gap: spacing.md,
  },
  // Header Card
  headerCard: {
    backgroundColor: colors.background.secondary,
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
  },
  stateBar: {
    height: 4,
    width: '100%',
  },
  headerContent: {
    padding: spacing.md,
  },
  stateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.sm,
    flexWrap: 'wrap',
  },
  stateChip: {
    height: 28,
  },
  stateChipText: {
    fontSize: 12,
    fontWeight: '600',
  },
  draftChip: {
    backgroundColor: colors.surface.border,
    height: 24,
  },
  draftChipText: {
    color: colors.text.muted,
    fontSize: 10,
  },
  prNumber: {
    color: colors.text.muted,
    fontSize: 14,
    fontWeight: '500',
  },
  title: {
    color: colors.text.primary,
    fontWeight: 'bold',
    marginBottom: spacing.sm,
    lineHeight: 28,
  },
  branchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: spacing.sm,
  },
  branchText: {
    color: colors.text.muted,
    fontSize: 12,
    fontFamily: 'monospace',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  authorAvatar: {
    backgroundColor: colors.surface.border,
  },
  authorLabel: {
    fontSize: 10,
    color: colors.text.secondary,
  },
  metaText: {
    color: colors.text.secondary,
    fontSize: 13,
  },
  // Sections
  section: {
    backgroundColor: colors.background.secondary,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
  },
  sectionTitle: {
    color: colors.text.primary,
    fontWeight: '600',
    marginBottom: spacing.sm,
  },
  // Checks
  checksHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  checksStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  checksStatusText: {
    fontSize: 13,
    fontWeight: '500',
  },
  checksList: {
    marginTop: spacing.sm,
    gap: spacing.xs,
  },
  checkItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  checkName: {
    color: colors.text.primary,
    fontSize: 13,
    flex: 1,
  },
  checkStatus: {
    color: colors.text.muted,
    fontSize: 11,
  },
  // Reviews
  reviewsSummary: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  reviewSummaryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  reviewSummaryText: {
    color: colors.text.secondary,
    fontSize: 13,
  },
  noReviews: {
    color: colors.text.muted,
    fontSize: 13,
    fontStyle: 'italic',
  },
  reviewsList: {
    marginTop: spacing.md,
    gap: spacing.sm,
  },
  reviewItem: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  reviewerAvatar: {
    backgroundColor: colors.surface.border,
  },
  reviewerLabel: {
    fontSize: 10,
    color: colors.text.secondary,
  },
  reviewContent: {
    flex: 1,
  },
  reviewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  reviewerName: {
    color: colors.text.primary,
    fontSize: 13,
    fontWeight: '500',
  },
  reviewStateChip: {
    height: 20,
  },
  reviewStateText: {
    fontSize: 10,
  },
  reviewBody: {
    color: colors.text.secondary,
    fontSize: 12,
    marginTop: spacing.xs,
  },
  // Diff stats
  diffStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: spacing.sm,
  },
  diffStatItem: {
    alignItems: 'center',
    gap: spacing.xs,
  },
  diffAdditions: {
    color: colors.status.success,
    fontSize: 18,
    fontWeight: '600',
  },
  diffDeletions: {
    color: colors.status.error,
    fontSize: 18,
    fontWeight: '600',
  },
  diffFiles: {
    color: colors.text.primary,
    fontSize: 18,
    fontWeight: '600',
  },
  diffLabel: {
    color: colors.text.muted,
    fontSize: 11,
  },
  diffBar: {
    flexDirection: 'row',
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
    backgroundColor: colors.surface.border,
  },
  diffBarAdditions: {
    backgroundColor: colors.status.success,
  },
  diffBarDeletions: {
    backgroundColor: colors.status.error,
  },
  // Labels
  labelsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  labelChip: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.round,
  },
  labelText: {
    fontSize: 12,
    fontWeight: '500',
  },
  // Body text
  bodyText: {
    color: colors.text.secondary,
    fontSize: 14,
    lineHeight: 22,
  },
  // Merge status
  mergeStatusRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  mergeStatusContent: {
    flex: 1,
  },
  mergeStatusTitle: {
    fontSize: 14,
    fontWeight: '600',
  },
  mergeStatusDescription: {
    color: colors.text.secondary,
    fontSize: 12,
    marginTop: spacing.xs,
  },
  // Linked task
  linkedTaskRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  linkedTaskInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  linkedTaskText: {
    color: colors.accent.primary,
    fontSize: 14,
    fontWeight: '500',
  },
  // Actions
  actionsContainer: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  actionButton: {
    flex: 1,
    borderRadius: borderRadius.md,
  },
  // Status
  statusCard: {
    backgroundColor: colors.background.elevated,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    gap: spacing.sm,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  statusText: {
    color: colors.text.secondary,
    fontSize: 13,
    fontStyle: 'italic',
  },
  // Repository
  repoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  repoText: {
    color: colors.text.muted,
    fontSize: 13,
  },
});

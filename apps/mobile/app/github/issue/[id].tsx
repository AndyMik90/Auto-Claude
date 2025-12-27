/**
 * GitHub Issue Detail Screen
 * Displays detailed information about a specific issue
 * Includes description, labels, comments, and action buttons
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
} from 'react-native-paper';
import { useLocalSearchParams, Stack, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useGitHubStore } from '../../../stores/githubStore';
import type { GitHubLabel, IssueState } from '../../../types';
import { colors, spacing, borderRadius, shadows } from '../../../theme';
import { EmptyState } from '../../../components';

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
 * GitHub Issue detail screen
 * Displays detailed information about a specific issue
 */
export default function IssueDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  // Get issue from store
  const getIssueById = useGitHubStore((state) => state.getIssueById);
  const investigateIssue = useGitHubStore((state) => state.investigateIssue);
  const stopInvestigation = useGitHubStore((state) => state.stopInvestigation);
  const autoFixIssue = useGitHubStore((state) => state.autoFixIssue);
  const stopAutoFix = useGitHubStore((state) => state.stopAutoFix);

  const issue = useMemo(() => (id ? getIssueById(id) : undefined), [id, getIssueById]);

  // Computed values
  const stateColor = useMemo(
    () => (issue ? getStateColor(issue.state) : colors.text.muted),
    [issue]
  );
  const stateIcon = useMemo(
    () => (issue ? getStateIcon(issue.state) : 'help-circle-outline'),
    [issue]
  );
  const createdTime = useMemo(
    () => (issue ? formatRelativeTime(issue.createdAt) : ''),
    [issue]
  );
  const updatedTime = useMemo(
    () => (issue ? formatRelativeTime(issue.updatedAt) : ''),
    [issue]
  );

  // Handlers
  const handleInvestigate = useCallback(() => {
    if (!issue) return;
    if (issue.isInvestigating) {
      stopInvestigation(issue.id);
    } else {
      investigateIssue(issue.id);
    }
  }, [issue, investigateIssue, stopInvestigation]);

  const handleAutoFix = useCallback(() => {
    if (!issue) return;
    if (issue.isAutoFixing) {
      stopAutoFix(issue.id);
    } else {
      autoFixIssue(issue.id);
    }
  }, [issue, autoFixIssue, stopAutoFix]);

  const handleOpenInGitHub = useCallback(() => {
    if (issue?.htmlUrl) {
      Linking.openURL(issue.htmlUrl);
    }
  }, [issue]);

  const handleViewLinkedTask = useCallback(() => {
    if (issue?.linkedTaskId) {
      router.push(`/task/${issue.linkedTaskId}`);
    }
  }, [issue, router]);

  // If issue not found
  if (!issue) {
    return (
      <>
        <Stack.Screen
          options={{
            title: 'Issue Not Found',
            headerStyle: { backgroundColor: colors.background.secondary },
            headerTintColor: colors.text.primary,
            headerShadowVisible: false,
          }}
        />
        <View style={styles.container}>
          <EmptyState
            icon="alert-circle-outline"
            title="Issue Not Found"
            description="The issue you're looking for doesn't exist or has been removed."
          />
        </View>
      </>
    );
  }

  return (
    <>
      <Stack.Screen
        options={{
          title: `#${issue.number}`,
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
                {issue.state === 'open' ? 'Open' : 'Closed'}
              </Chip>
              <Text style={styles.issueNumber}>#{issue.number}</Text>
            </View>

            {/* Title */}
            <Text variant="headlineSmall" style={styles.title}>
              {issue.title}
            </Text>

            {/* Meta info */}
            <View style={styles.metaRow}>
              <Avatar.Text
                size={24}
                label={issue.author.login.substring(0, 2).toUpperCase()}
                style={styles.authorAvatar}
                labelStyle={styles.authorLabel}
              />
              <Text style={styles.metaText}>
                {issue.author.login} opened {createdTime}
              </Text>
            </View>
          </View>
        </Surface>

        {/* Labels Section */}
        {issue.labels.length > 0 && (
          <Surface style={styles.section} elevation={1}>
            <Text variant="titleSmall" style={styles.sectionTitle}>
              Labels
            </Text>
            <View style={styles.labelsContainer}>
              {issue.labels.map((label) => (
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
            {issue.body || 'No description provided.'}
          </Text>
        </Surface>

        {/* Assignees Section */}
        {issue.assignees && issue.assignees.length > 0 && (
          <Surface style={styles.section} elevation={1}>
            <Text variant="titleSmall" style={styles.sectionTitle}>
              Assignees
            </Text>
            <View style={styles.assigneesContainer}>
              {issue.assignees.map((assignee) => (
                <View key={assignee.id} style={styles.assigneeItem}>
                  <Avatar.Text
                    size={32}
                    label={assignee.login.substring(0, 2).toUpperCase()}
                    style={styles.assigneeAvatar}
                    labelStyle={styles.assigneeLabel}
                  />
                  <Text style={styles.assigneeName}>{assignee.login}</Text>
                </View>
              ))}
            </View>
          </Surface>
        )}

        {/* Stats Section */}
        <Surface style={styles.section} elevation={1}>
          <Text variant="titleSmall" style={styles.sectionTitle}>
            Activity
          </Text>
          <View style={styles.statsGrid}>
            <View style={styles.statItem}>
              <Icon name="comment-outline" size={20} color={colors.text.muted} />
              <Text style={styles.statValue}>{issue.commentCount}</Text>
              <Text style={styles.statLabel}>Comments</Text>
            </View>
            <View style={styles.statItem}>
              <Icon name="update" size={20} color={colors.text.muted} />
              <Text style={styles.statValue}>{updatedTime}</Text>
              <Text style={styles.statLabel}>Last updated</Text>
            </View>
          </View>
        </Surface>

        {/* Linked Task Section */}
        {issue.linkedTaskId && (
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
        {issue.state === 'open' && (
          <View style={styles.actionsContainer}>
            <Button
              mode={issue.isInvestigating ? 'contained' : 'outlined'}
              onPress={handleInvestigate}
              icon={issue.isInvestigating ? 'stop' : 'magnify'}
              style={styles.actionButton}
              buttonColor={issue.isInvestigating ? colors.status.info : undefined}
              textColor={issue.isInvestigating ? colors.text.primary : colors.status.info}
              accessibilityLabel={
                issue.isInvestigating ? 'Stop investigation' : 'Investigate issue'
              }
            >
              {issue.isInvestigating ? 'Stop Investigating' : 'Investigate'}
            </Button>

            <Button
              mode={issue.isAutoFixing ? 'contained' : 'outlined'}
              onPress={handleAutoFix}
              icon={issue.isAutoFixing ? 'stop' : 'wrench'}
              style={styles.actionButton}
              buttonColor={issue.isAutoFixing ? colors.accent.primary : undefined}
              textColor={issue.isAutoFixing ? colors.text.inverse : colors.accent.primary}
              accessibilityLabel={issue.isAutoFixing ? 'Stop auto-fix' : 'Auto-fix issue'}
            >
              {issue.isAutoFixing ? 'Stop Auto-fix' : 'Auto-fix'}
            </Button>
          </View>
        )}

        {/* Status Indicators */}
        {(issue.isInvestigating || issue.isAutoFixing) && (
          <Surface style={styles.statusCard} elevation={1}>
            {issue.isInvestigating && (
              <View style={styles.statusRow}>
                <ActivityIndicator size={16} color={colors.status.info} />
                <Text style={styles.statusText}>
                  Claude is investigating this issue...
                </Text>
              </View>
            )}
            {issue.isAutoFixing && (
              <View style={styles.statusRow}>
                <ActivityIndicator size={16} color={colors.accent.primary} />
                <Text style={styles.statusText}>
                  Claude is working on a fix...
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
              {issue.repositoryOwner}/{issue.repositoryName}
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
  },
  stateChip: {
    height: 28,
  },
  stateChipText: {
    fontSize: 12,
    fontWeight: '600',
  },
  issueNumber: {
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
  // Assignees
  assigneesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  assigneeItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  assigneeAvatar: {
    backgroundColor: colors.surface.border,
  },
  assigneeLabel: {
    fontSize: 10,
    color: colors.text.secondary,
  },
  assigneeName: {
    color: colors.text.primary,
    fontSize: 14,
  },
  // Stats
  statsGrid: {
    flexDirection: 'row',
    gap: spacing.lg,
  },
  statItem: {
    alignItems: 'center',
    gap: spacing.xs,
  },
  statValue: {
    color: colors.text.primary,
    fontSize: 16,
    fontWeight: '600',
  },
  statLabel: {
    color: colors.text.muted,
    fontSize: 11,
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

/**
 * ProjectListItem Component
 * Displays a project item in a list with status, progress, and task stats
 * Supports onPress for navigation and onLongPress for quick actions
 */

import React, { useCallback, useMemo } from 'react';
import { StyleSheet, View, Pressable } from 'react-native';
import { Surface, Text, Chip, ProgressBar, Avatar } from 'react-native-paper';
import { useRouter } from 'expo-router';
import type { Project, ProjectStatus } from '../types';
import { colors, spacing, borderRadius, shadows } from '../theme';

/**
 * Props for the ProjectListItem component
 */
interface ProjectListItemProps {
  /** The project to display */
  project: Project;
  /** Called when the item is pressed (navigation) */
  onPress?: (project: Project) => void;
  /** Called when the item is long-pressed (quick actions) */
  onLongPress?: (project: Project) => void;
  /** Whether the item is selected */
  isSelected?: boolean;
  /** Whether the item is disabled */
  disabled?: boolean;
  /** Test ID for testing purposes */
  testID?: string;
}

/**
 * Get the color for a project status
 */
const getStatusColor = (status: ProjectStatus): string => {
  const statusColors: Record<ProjectStatus, string> = {
    active: colors.status.success,
    paused: colors.status.warning,
    completed: colors.status.info,
    archived: colors.text.muted,
  };
  return statusColors[status] || colors.text.muted;
};

/**
 * Get display label for status
 */
const getStatusLabel = (status: ProjectStatus): string => {
  const labels: Record<ProjectStatus, string> = {
    active: 'Active',
    paused: 'Paused',
    completed: 'Completed',
    archived: 'Archived',
  };
  return labels[status] || status;
};

/**
 * Get icon for project status
 */
const getStatusIcon = (status: ProjectStatus): string => {
  const icons: Record<ProjectStatus, string> = {
    active: 'play-circle',
    paused: 'pause-circle',
    completed: 'check-circle',
    archived: 'archive',
  };
  return icons[status] || 'folder';
};

/**
 * Calculate project progress from stats
 */
const calculateProgress = (project: Project): number => {
  if (!project.stats || project.stats.totalTasks === 0) return 0;
  return project.stats.completedTasks / project.stats.totalTasks;
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
 * ProjectListItem Component
 * A list item component for displaying project information
 */
export const ProjectListItem: React.FC<ProjectListItemProps> = ({
  project,
  onPress,
  onLongPress,
  isSelected = false,
  disabled = false,
  testID,
}) => {
  const router = useRouter();

  // Memoize handlers to prevent unnecessary re-renders
  const handlePress = useCallback(() => {
    if (!disabled) {
      if (onPress) {
        onPress(project);
      } else {
        router.push(`/project/${project.id}`);
      }
    }
  }, [disabled, onPress, project, router]);

  const handleLongPress = useCallback(() => {
    if (!disabled && onLongPress) {
      onLongPress(project);
    }
  }, [disabled, onLongPress, project]);

  // Memoize computed values
  const statusColor = useMemo(() => getStatusColor(project.status), [project.status]);
  const statusLabel = useMemo(() => getStatusLabel(project.status), [project.status]);
  const statusIcon = useMemo(() => getStatusIcon(project.status), [project.status]);
  const progress = useMemo(() => calculateProgress(project), [project]);
  const lastOpened = useMemo(() => formatRelativeTime(project.lastOpenedAt), [project.lastOpenedAt]);

  // Task stats
  const taskStats = useMemo(() => {
    if (!project.stats) return null;
    return {
      total: project.stats.totalTasks,
      done: project.stats.completedTasks,
      inProgress: project.stats.inProgressTasks + project.stats.aiReviewTasks + project.stats.humanReviewTasks,
      backlog: project.stats.backlogTasks,
    };
  }, [project.stats]);

  // Generate accessibility label
  const accessibilityLabel = useMemo(() => {
    const parts = [
      `Project: ${project.name}`,
      `Status: ${statusLabel}`,
    ];
    if (taskStats) {
      parts.push(`${taskStats.done} of ${taskStats.total} tasks completed`);
    }
    parts.push(`Last opened: ${lastOpened}`);
    return parts.join('. ');
  }, [project.name, statusLabel, taskStats, lastOpened]);

  return (
    <Pressable
      onPress={handlePress}
      onLongPress={handleLongPress}
      disabled={disabled}
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      accessibilityHint="Double tap to view project details. Long press for quick actions."
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
              {/* Project icon */}
              <Avatar.Icon
                size={40}
                icon="folder-outline"
                style={[styles.avatar, { backgroundColor: `${statusColor}20` }]}
                color={statusColor}
              />

              {/* Title and description */}
              <View style={styles.titleContainer}>
                <Text
                  style={[styles.title, disabled && styles.textDisabled]}
                  numberOfLines={1}
                  ellipsizeMode="tail"
                  variant="titleMedium"
                >
                  {project.name}
                </Text>
                {project.description && (
                  <Text
                    style={styles.description}
                    numberOfLines={1}
                    ellipsizeMode="tail"
                  >
                    {project.description}
                  </Text>
                )}
              </View>

              {/* Status badge */}
              <Chip
                mode="flat"
                icon={statusIcon}
                style={[styles.statusBadge, { backgroundColor: `${statusColor}20` }]}
                textStyle={[styles.statusBadgeText, { color: statusColor }]}
                compact
                accessibilityLabel={`Status: ${statusLabel}`}
              >
                {statusLabel}
              </Chip>
            </View>

            {/* Progress bar */}
            {taskStats && taskStats.total > 0 && (
              <View style={styles.progressSection}>
                <ProgressBar
                  progress={progress}
                  color={colors.accent.primary}
                  style={styles.progressBar}
                  accessibilityLabel={`Progress: ${Math.round(progress * 100)}%`}
                />
                <Text style={styles.progressText}>
                  {taskStats.done}/{taskStats.total} tasks
                </Text>
              </View>
            )}

            {/* Footer row */}
            <View style={styles.footer}>
              {/* Task stats pills */}
              {taskStats && (
                <View style={styles.statsContainer}>
                  {taskStats.inProgress > 0 && (
                    <View
                      style={[styles.statPill, { backgroundColor: `${colors.taskStatus.in_progress}20` }]}
                      accessibilityLabel={`${taskStats.inProgress} tasks in progress`}
                    >
                      <View style={[styles.statDot, { backgroundColor: colors.taskStatus.in_progress }]} />
                      <Text style={[styles.statText, { color: colors.taskStatus.in_progress }]}>
                        {taskStats.inProgress}
                      </Text>
                    </View>
                  )}
                  {taskStats.backlog > 0 && (
                    <View
                      style={[styles.statPill, { backgroundColor: `${colors.taskStatus.backlog}20` }]}
                      accessibilityLabel={`${taskStats.backlog} tasks in backlog`}
                    >
                      <View style={[styles.statDot, { backgroundColor: colors.taskStatus.backlog }]} />
                      <Text style={[styles.statText, { color: colors.taskStatus.backlog }]}>
                        {taskStats.backlog}
                      </Text>
                    </View>
                  )}
                </View>
              )}

              {/* Last opened time */}
              <Text style={styles.timestamp}>
                {lastOpened}
              </Text>
            </View>

            {/* Repository indicator */}
            {project.repositoryUrl && (
              <View style={styles.repositoryRow}>
                <Avatar.Icon
                  size={16}
                  icon="github"
                  style={styles.repoIcon}
                  color={colors.text.muted}
                />
                <Text style={styles.repoText} numberOfLines={1}>
                  {project.repositoryUrl.replace(/^https?:\/\/(www\.)?github\.com\//, '')}
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
    alignItems: 'center',
    gap: spacing.sm,
  },
  avatar: {
    backgroundColor: colors.surface.primary,
  },
  titleContainer: {
    flex: 1,
  },
  title: {
    color: colors.text.primary,
    fontWeight: '600',
  },
  description: {
    color: colors.text.secondary,
    fontSize: 13,
    marginTop: 2,
  },
  textDisabled: {
    color: colors.text.disabled,
  },
  statusBadge: {
    height: 28,
    borderRadius: borderRadius.sm,
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: '500',
  },
  progressSection: {
    marginTop: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  progressBar: {
    flex: 1,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.surface.border,
  },
  progressText: {
    color: colors.text.muted,
    fontSize: 12,
    minWidth: 60,
    textAlign: 'right',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  statsContainer: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  statPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.xs,
    paddingVertical: 2,
    borderRadius: borderRadius.sm,
    gap: 4,
  },
  statDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statText: {
    fontSize: 11,
    fontWeight: '500',
  },
  timestamp: {
    color: colors.text.muted,
    fontSize: 12,
  },
  repositoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.sm,
    gap: spacing.xs,
  },
  repoIcon: {
    backgroundColor: 'transparent',
  },
  repoText: {
    color: colors.text.muted,
    fontSize: 12,
    flex: 1,
  },
});

export default ProjectListItem;

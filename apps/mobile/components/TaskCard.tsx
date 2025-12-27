/**
 * TaskCard Component
 * Displays a task card for the Kanban board with title, badges, and complexity indicator
 * Supports onPress for navigation and onLongPress for quick actions
 */

import React, { useCallback, useMemo } from 'react';
import { StyleSheet, View, Pressable } from 'react-native';
import { Surface, Text, Chip } from 'react-native-paper';
import { useRouter } from 'expo-router';
import type { Task, TaskStatus, TaskPriority, TaskCategory } from '../types';
import { colors, spacing, borderRadius, shadows } from '../theme';

/**
 * Props for the TaskCard component
 */
interface TaskCardProps {
  /** The task to display */
  task: Task;
  /** Called when the card is pressed (navigation) */
  onPress?: (task: Task) => void;
  /** Called when the card is long-pressed (quick actions) */
  onLongPress?: (task: Task) => void;
  /** Whether the card is currently being dragged */
  isDragging?: boolean;
  /** Whether the card is disabled */
  disabled?: boolean;
  /** Test ID for testing purposes */
  testID?: string;
}

/**
 * Get the color for a task status
 */
const getStatusColor = (status: TaskStatus): string => {
  return colors.taskStatus[status] || colors.taskStatus.backlog;
};

/**
 * Get the color for a task priority
 */
const getPriorityColor = (priority: TaskPriority): string => {
  return colors.priority[priority] || colors.priority.medium;
};

/**
 * Get display label for status
 */
const getStatusLabel = (status: TaskStatus): string => {
  const labels: Record<TaskStatus, string> = {
    backlog: 'Backlog',
    in_progress: 'In Progress',
    ai_review: 'AI Review',
    human_review: 'Human Review',
    done: 'Done',
  };
  return labels[status] || status;
};

/**
 * Get display label for priority
 */
const getPriorityLabel = (priority: TaskPriority): string => {
  const labels: Record<TaskPriority, string> = {
    low: 'Low',
    medium: 'Medium',
    high: 'High',
    critical: 'Critical',
  };
  return labels[priority] || priority;
};

/**
 * Get the icon for a category
 */
const getCategoryIcon = (category: TaskCategory): string => {
  const icons: Record<TaskCategory, string> = {
    feature: 'star',
    bug: 'bug',
    refactor: 'wrench',
    documentation: 'file-document',
    test: 'test-tube',
    chore: 'cog',
    research: 'magnify',
  };
  return icons[category] || 'help-circle';
};

/**
 * Complexity indicator component
 * Shows a visual bar representing task complexity (1-10)
 */
const ComplexityIndicator: React.FC<{ complexity: number }> = ({ complexity }) => {
  const normalizedComplexity = Math.min(Math.max(complexity, 1), 10);
  const percentage = (normalizedComplexity / 10) * 100;

  // Color based on complexity level
  const getComplexityColor = (): string => {
    if (normalizedComplexity <= 3) return colors.status.success;
    if (normalizedComplexity <= 6) return colors.status.warning;
    return colors.status.error;
  };

  return (
    <View
      style={styles.complexityContainer}
      accessibilityLabel={`Complexity ${complexity} out of 10`}
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 1, max: 10, now: complexity }}
    >
      <View style={styles.complexityTrack}>
        <View
          style={[
            styles.complexityFill,
            { width: `${percentage}%`, backgroundColor: getComplexityColor() },
          ]}
        />
      </View>
      <Text style={styles.complexityText} variant="labelSmall">
        {complexity}
      </Text>
    </View>
  );
};

/**
 * TaskCard Component
 * A card component for displaying task information in the Kanban board
 */
export const TaskCard: React.FC<TaskCardProps> = ({
  task,
  onPress,
  onLongPress,
  isDragging = false,
  disabled = false,
  testID,
}) => {
  const router = useRouter();

  // Memoize handlers to prevent unnecessary re-renders
  // Default navigation to task detail if onPress is not provided
  const handlePress = useCallback(() => {
    if (!disabled) {
      if (onPress) {
        onPress(task);
      } else {
        // Default: navigate to task detail screen
        router.push(`/task/${task.id}`);
      }
    }
  }, [disabled, onPress, task, router]);

  const handleLongPress = useCallback(() => {
    if (!disabled && onLongPress) {
      onLongPress(task);
    }
  }, [disabled, onLongPress, task]);

  // Memoize colors and labels
  const statusColor = useMemo(() => getStatusColor(task.status), [task.status]);
  const priorityColor = useMemo(() => getPriorityColor(task.priority), [task.priority]);
  const statusLabel = useMemo(() => getStatusLabel(task.status), [task.status]);
  const priorityLabel = useMemo(() => getPriorityLabel(task.priority), [task.priority]);
  const categoryIcon = useMemo(() => getCategoryIcon(task.category), [task.category]);

  // Generate accessibility label
  const accessibilityLabel = useMemo(() => {
    return `Task: ${task.title}. Status: ${statusLabel}. Priority: ${priorityLabel}. Complexity: ${task.complexity} out of 10.`;
  }, [task.title, statusLabel, priorityLabel, task.complexity]);

  return (
    <Pressable
      onPress={handlePress}
      onLongPress={handleLongPress}
      disabled={disabled}
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      accessibilityHint="Double tap to view task details. Long press for quick actions."
      accessibilityState={{ disabled, selected: isDragging }}
      testID={testID}
    >
      {({ pressed }) => (
        <Surface
          style={[
            styles.card,
            isDragging && styles.cardDragging,
            pressed && styles.cardPressed,
            disabled && styles.cardDisabled,
          ]}
          elevation={isDragging ? 4 : 1}
        >
          {/* Category indicator bar */}
          <View
            style={[styles.categoryBar, { backgroundColor: statusColor }]}
            accessibilityElementsHidden
          />

          <View style={styles.content}>
            {/* Title */}
            <Text
              style={[styles.title, disabled && styles.textDisabled]}
              numberOfLines={2}
              ellipsizeMode="tail"
              variant="titleSmall"
            >
              {task.title}
            </Text>

            {/* Badges row */}
            <View style={styles.badgesRow}>
              {/* Status badge */}
              <Chip
                mode="flat"
                style={[styles.badge, { backgroundColor: `${statusColor}20` }]}
                textStyle={[styles.badgeText, { color: statusColor }]}
                compact
                accessibilityLabel={`Status: ${statusLabel}`}
              >
                {statusLabel}
              </Chip>

              {/* Priority badge */}
              <Chip
                mode="flat"
                style={[styles.badge, { backgroundColor: `${priorityColor}20` }]}
                textStyle={[styles.badgeText, { color: priorityColor }]}
                compact
                icon={task.priority === 'critical' ? 'alert-circle' : undefined}
                accessibilityLabel={`Priority: ${priorityLabel}`}
              >
                {priorityLabel}
              </Chip>
            </View>

            {/* Bottom row: Labels and Complexity */}
            <View style={styles.bottomRow}>
              {/* Labels (show first 2) */}
              {task.labels && task.labels.length > 0 && (
                <View style={styles.labelsContainer}>
                  {task.labels.slice(0, 2).map((label, index) => (
                    <View
                      key={`${label}-${index}`}
                      style={styles.label}
                      accessibilityLabel={`Label: ${label}`}
                    >
                      <Text style={styles.labelText} numberOfLines={1}>
                        {label}
                      </Text>
                    </View>
                  ))}
                  {task.labels.length > 2 && (
                    <Text
                      style={styles.moreLabels}
                      accessibilityLabel={`${task.labels.length - 2} more labels`}
                    >
                      +{task.labels.length - 2}
                    </Text>
                  )}
                </View>
              )}

              {/* Complexity indicator */}
              <ComplexityIndicator complexity={task.complexity} />
            </View>

            {/* Execution state indicator (if running/paused) */}
            {(task.executionState === 'running' || task.executionState === 'paused') && (
              <View style={styles.executionRow}>
                <View
                  style={[
                    styles.executionDot,
                    {
                      backgroundColor:
                        task.executionState === 'running'
                          ? colors.status.success
                          : colors.status.warning,
                    },
                  ]}
                  accessibilityElementsHidden
                />
                <Text
                  style={styles.executionText}
                  accessibilityLabel={`Task is ${task.executionState}`}
                >
                  {task.executionState === 'running' ? 'Running' : 'Paused'}
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
  card: {
    backgroundColor: colors.background.secondary,
    borderRadius: borderRadius.md,
    overflow: 'hidden',
    marginVertical: spacing.xs,
    marginHorizontal: spacing.xs,
    ...shadows.small,
  },
  cardDragging: {
    opacity: 0.9,
    transform: [{ scale: 1.02 }],
    ...shadows.large,
  },
  cardPressed: {
    opacity: 0.8,
  },
  cardDisabled: {
    opacity: 0.5,
  },
  categoryBar: {
    height: 3,
    width: '100%',
  },
  content: {
    padding: spacing.sm,
  },
  title: {
    color: colors.text.primary,
    fontWeight: '600',
    marginBottom: spacing.xs,
    lineHeight: 20,
  },
  textDisabled: {
    color: colors.text.disabled,
  },
  badgesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginBottom: spacing.sm,
  },
  badge: {
    height: 24,
    borderRadius: borderRadius.sm,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '500',
    marginVertical: 0,
    marginHorizontal: 0,
  },
  bottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  labelsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    flex: 1,
    marginRight: spacing.sm,
  },
  label: {
    backgroundColor: colors.surface.primary,
    paddingHorizontal: spacing.xs,
    paddingVertical: 2,
    borderRadius: borderRadius.sm,
    maxWidth: 80,
  },
  labelText: {
    color: colors.text.secondary,
    fontSize: 10,
  },
  moreLabels: {
    color: colors.text.muted,
    fontSize: 10,
  },
  complexityContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  complexityTrack: {
    width: 40,
    height: 4,
    backgroundColor: colors.surface.border,
    borderRadius: 2,
    overflow: 'hidden',
  },
  complexityFill: {
    height: '100%',
    borderRadius: 2,
  },
  complexityText: {
    color: colors.text.muted,
    fontSize: 10,
    minWidth: 12,
    textAlign: 'right',
  },
  executionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.sm,
    gap: spacing.xs,
  },
  executionDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  executionText: {
    color: colors.text.secondary,
    fontSize: 11,
    fontWeight: '500',
  },
});

export default TaskCard;

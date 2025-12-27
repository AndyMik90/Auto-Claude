/**
 * KanbanColumn Component
 * Displays a single column in the Kanban board with header, task count, and task list
 * Supports receiving dropped tasks from other columns
 */

import React, { useCallback, useMemo } from 'react';
import { StyleSheet, View, FlatList, ListRenderItem } from 'react-native';
import { Surface, Text, Badge } from 'react-native-paper';
import Animated, {
  useAnimatedStyle,
  withSpring,
  SharedValue,
} from 'react-native-reanimated';
import type { Task, TaskStatus } from '../types';
import { TaskCard } from './TaskCard';
import { colors, spacing, borderRadius, shadows } from '../theme';

/**
 * Column configuration with display name and styling
 */
export interface ColumnConfig {
  id: TaskStatus;
  title: string;
  color: string;
}

/**
 * All Kanban columns configuration
 */
export const KANBAN_COLUMNS: ColumnConfig[] = [
  { id: 'backlog', title: 'Backlog', color: colors.taskStatus.backlog },
  { id: 'in_progress', title: 'In Progress', color: colors.taskStatus.in_progress },
  { id: 'ai_review', title: 'AI Review', color: colors.taskStatus.ai_review },
  { id: 'human_review', title: 'Human Review', color: colors.taskStatus.human_review },
  { id: 'done', title: 'Done', color: colors.taskStatus.done },
];

/**
 * Props for the KanbanColumn component
 */
interface KanbanColumnProps {
  /** Column configuration */
  column: ColumnConfig;
  /** Tasks in this column */
  tasks: Task[];
  /** Called when a task card is pressed */
  onTaskPress?: (task: Task) => void;
  /** Called when a task card is long-pressed */
  onTaskLongPress?: (task: Task) => void;
  /** Called when drag starts on a task */
  onDragStart?: (task: Task) => void;
  /** Column width for horizontal scrolling */
  columnWidth: number;
  /** Whether a task is currently being dragged */
  isDragging?: boolean;
  /** The currently dragged task (for hiding from original column) */
  draggedTask?: Task | null;
  /** Whether this column is the current drop target */
  isDropTarget?: boolean;
  /** Animated scale for drop target highlighting */
  dropTargetScale?: SharedValue<number>;
  /** Test ID for testing purposes */
  testID?: string;
}

/**
 * KanbanColumn Component
 * A single column in the Kanban board displaying tasks for a specific status
 */
export const KanbanColumn: React.FC<KanbanColumnProps> = ({
  column,
  tasks,
  onTaskPress,
  onTaskLongPress,
  onDragStart,
  columnWidth,
  isDragging = false,
  draggedTask = null,
  isDropTarget = false,
  dropTargetScale,
  testID,
}) => {
  // Filter out the dragged task from its original column
  const visibleTasks = useMemo(() => {
    if (draggedTask && draggedTask.status === column.id) {
      return tasks.filter((task) => task.id !== draggedTask.id);
    }
    return tasks;
  }, [tasks, draggedTask, column.id]);

  // Count including dragged task (for accurate display)
  const taskCount = tasks.length;

  // Animated style for drop target highlighting
  const animatedStyle = useAnimatedStyle(() => {
    if (dropTargetScale) {
      return {
        transform: [{ scale: isDropTarget ? dropTargetScale.value : 1 }],
        borderColor: isDropTarget ? column.color : 'transparent',
        borderWidth: isDropTarget ? 2 : 0,
      };
    }
    return {
      borderColor: isDropTarget ? column.color : 'transparent',
      borderWidth: isDropTarget ? 2 : 0,
    };
  }, [isDropTarget, column.color, dropTargetScale]);

  // Handle task press with optional callback
  const handleTaskPress = useCallback(
    (task: Task) => {
      onTaskPress?.(task);
    },
    [onTaskPress]
  );

  // Handle task long press for drag initiation
  const handleTaskLongPress = useCallback(
    (task: Task) => {
      onTaskLongPress?.(task);
      onDragStart?.(task);
    },
    [onTaskLongPress, onDragStart]
  );

  // Render individual task card
  const renderTask: ListRenderItem<Task> = useCallback(
    ({ item }) => (
      <TaskCard
        task={item}
        onPress={() => handleTaskPress(item)}
        onLongPress={() => handleTaskLongPress(item)}
        isDragging={false}
        testID={`${testID}-task-${item.id}`}
      />
    ),
    [handleTaskPress, handleTaskLongPress, testID]
  );

  // Key extractor for FlatList
  const keyExtractor = useCallback((item: Task) => item.id, []);

  // Empty state component
  const ListEmptyComponent = useMemo(
    () => (
      <View style={styles.emptyState}>
        <Text style={styles.emptyText}>No tasks</Text>
        <Text style={styles.emptySubtext}>Drag tasks here or tap + to create</Text>
      </View>
    ),
    []
  );

  return (
    <Animated.View
      style={[
        styles.container,
        { width: columnWidth },
        animatedStyle,
      ]}
      testID={testID}
      accessibilityLabel={`${column.title} column with ${taskCount} tasks`}
      accessibilityRole="list"
    >
      {/* Column Header */}
      <View style={styles.header}>
        <View style={styles.headerContent}>
          {/* Color indicator */}
          <View
            style={[styles.colorIndicator, { backgroundColor: column.color }]}
            accessibilityElementsHidden
          />
          <Text
            style={styles.headerTitle}
            variant="titleMedium"
            numberOfLines={1}
          >
            {column.title}
          </Text>
        </View>
        <Badge
          size={24}
          style={[styles.badge, { backgroundColor: `${column.color}30` }]}
          accessibilityLabel={`${taskCount} tasks`}
        >
          {taskCount}
        </Badge>
      </View>

      {/* Drop zone indicator when dragging */}
      {isDragging && (
        <Surface
          style={[
            styles.dropZone,
            isDropTarget && styles.dropZoneActive,
            { borderColor: column.color },
          ]}
          elevation={isDropTarget ? 2 : 0}
        >
          <Text
            style={[
              styles.dropZoneText,
              isDropTarget && { color: column.color },
            ]}
          >
            {isDropTarget ? 'Drop here' : 'Drop to move'}
          </Text>
        </Surface>
      )}

      {/* Task List */}
      <FlatList
        data={visibleTasks}
        renderItem={renderTask}
        keyExtractor={keyExtractor}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={!isDragging ? ListEmptyComponent : null}
        // Performance optimizations
        removeClippedSubviews
        maxToRenderPerBatch={10}
        initialNumToRender={5}
        windowSize={5}
        // Accessibility
        accessibilityLabel={`${column.title} task list`}
      />
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.background.tertiary,
    borderRadius: borderRadius.lg,
    marginHorizontal: spacing.xs,
    paddingBottom: spacing.sm,
    minHeight: 200,
    maxHeight: '100%',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.surface.border,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  colorIndicator: {
    width: 4,
    height: 20,
    borderRadius: 2,
    marginRight: spacing.sm,
  },
  headerTitle: {
    color: colors.text.primary,
    fontWeight: '600',
    flex: 1,
  },
  badge: {
    marginLeft: spacing.sm,
  },
  dropZone: {
    marginHorizontal: spacing.sm,
    marginTop: spacing.sm,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 2,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  dropZoneActive: {
    backgroundColor: `${colors.accent.primary}10`,
  },
  dropZoneText: {
    color: colors.text.muted,
    fontSize: 12,
    fontWeight: '500',
  },
  listContent: {
    paddingHorizontal: spacing.xs,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
    flexGrow: 1,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xl,
  },
  emptyText: {
    color: colors.text.muted,
    fontSize: 14,
    fontWeight: '500',
  },
  emptySubtext: {
    color: colors.text.disabled,
    fontSize: 12,
    marginTop: spacing.xs,
    textAlign: 'center',
  },
});

export default KanbanColumn;

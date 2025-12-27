/**
 * KanbanBoard Component
 * Horizontally scrollable board with 5 columns for task management
 * Supports drag-and-drop between columns using react-native-gesture-handler
 */

import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  StyleSheet,
  View,
  ScrollView,
  useWindowDimensions,
  Platform,
  LayoutRectangle,
} from 'react-native';
import { Text, ActivityIndicator } from 'react-native-paper';
import {
  Gesture,
  GestureDetector,
  GestureHandlerRootView,
} from 'react-native-gesture-handler';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  runOnJS,
  withTiming,
} from 'react-native-reanimated';
import type { Task, TaskStatus } from '../types';
import { useTaskStore, useTaskCounts } from '../stores/taskStore';
import { KanbanColumn, KANBAN_COLUMNS, ColumnConfig } from './KanbanColumn';
import { TaskCard } from './TaskCard';
import { colors, spacing, borderRadius } from '../theme';

/**
 * Props for the KanbanBoard component
 */
interface KanbanBoardProps {
  /** Filter tasks by project ID */
  projectId?: string;
  /** Called when a task is pressed (navigation) */
  onTaskPress?: (task: Task) => void;
  /** Called when a task is long-pressed (quick actions) */
  onTaskLongPress?: (task: Task) => void;
  /** Called when a task is moved between columns */
  onTaskMove?: (task: Task, fromStatus: TaskStatus, toStatus: TaskStatus) => void;
  /** Minimum width for each column */
  minColumnWidth?: number;
  /** Maximum width for each column */
  maxColumnWidth?: number;
  /** Test ID for testing purposes */
  testID?: string;
}

/**
 * Calculate column layout positions for drop detection
 */
interface ColumnLayout {
  status: TaskStatus;
  x: number;
  width: number;
}

/**
 * Spring configuration for animations
 */
const SPRING_CONFIG = {
  damping: 20,
  stiffness: 300,
  mass: 0.5,
};

/**
 * KanbanBoard Component
 * Main Kanban board with horizontal scrolling and drag-and-drop support
 */
export const KanbanBoard: React.FC<KanbanBoardProps> = ({
  projectId,
  onTaskPress,
  onTaskLongPress,
  onTaskMove,
  minColumnWidth = 280,
  maxColumnWidth = 340,
  testID = 'kanban-board',
}) => {
  const { width: screenWidth } = useWindowDimensions();
  const scrollViewRef = useRef<ScrollView>(null);

  // Store hooks
  const tasks = useTaskStore((state) => state.tasks);
  const moveTask = useTaskStore((state) => state.moveTask);
  const taskCounts = useTaskCounts();

  // Drag state
  const [isDragging, setIsDragging] = useState(false);
  const [draggedTask, setDraggedTask] = useState<Task | null>(null);
  const [activeDropColumn, setActiveDropColumn] = useState<TaskStatus | null>(null);
  const [columnLayouts, setColumnLayouts] = useState<ColumnLayout[]>([]);

  // Animated values for dragging
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const dragScale = useSharedValue(1);
  const dragOpacity = useSharedValue(0);
  const scrollOffset = useSharedValue(0);

  // Animated value for drop target
  const dropTargetScale = useSharedValue(1);

  // Calculate column width based on screen size
  const columnWidth = useMemo(() => {
    // On smaller screens, show ~1.2 columns; on larger, show more
    const columnsVisible = screenWidth < 400 ? 1.2 : screenWidth < 600 ? 1.5 : 2;
    const calculatedWidth = (screenWidth - spacing.md * 2) / columnsVisible;
    return Math.min(Math.max(calculatedWidth, minColumnWidth), maxColumnWidth);
  }, [screenWidth, minColumnWidth, maxColumnWidth]);

  // Calculate total board width
  const boardWidth = useMemo(() => {
    return columnWidth * KANBAN_COLUMNS.length + spacing.md * 2;
  }, [columnWidth]);

  // Filter tasks by project if projectId is provided
  const filteredTasks = useMemo(() => {
    if (projectId) {
      return tasks.filter((task) => task.projectId === projectId);
    }
    return tasks;
  }, [tasks, projectId]);

  // Group tasks by status
  const tasksByStatus = useMemo(() => {
    const grouped: Record<TaskStatus, Task[]> = {
      backlog: [],
      in_progress: [],
      ai_review: [],
      human_review: [],
      done: [],
    };

    filteredTasks.forEach((task) => {
      if (grouped[task.status]) {
        grouped[task.status].push(task);
      }
    });

    return grouped;
  }, [filteredTasks]);

  // Handle column layout measurement for drop detection
  const handleColumnLayout = useCallback(
    (status: TaskStatus, layout: LayoutRectangle, index: number) => {
      setColumnLayouts((prev) => {
        const newLayouts = [...prev];
        const columnX = spacing.md + index * (columnWidth + spacing.xs * 2);
        newLayouts[index] = {
          status,
          x: columnX,
          width: columnWidth,
        };
        return newLayouts;
      });
    },
    [columnWidth]
  );

  // Find which column the drag position is over
  const findDropColumn = useCallback(
    (x: number): TaskStatus | null => {
      const adjustedX = x + scrollOffset.value;
      for (const layout of columnLayouts) {
        if (adjustedX >= layout.x && adjustedX <= layout.x + layout.width) {
          return layout.status;
        }
      }
      return null;
    },
    [columnLayouts, scrollOffset]
  );

  // Handle drag start
  const handleDragStart = useCallback((task: Task) => {
    setDraggedTask(task);
    setIsDragging(true);
  }, []);

  // Handle drag end - update task status
  const handleDragEnd = useCallback(
    (targetStatus: TaskStatus | null) => {
      if (draggedTask && targetStatus && targetStatus !== draggedTask.status) {
        // Move the task in the store
        moveTask(draggedTask.id, targetStatus);
        // Notify parent component
        onTaskMove?.(draggedTask, draggedTask.status, targetStatus);
      }
      setDraggedTask(null);
      setIsDragging(false);
      setActiveDropColumn(null);
    },
    [draggedTask, moveTask, onTaskMove]
  );

  // Update active drop column during drag
  const updateDropColumn = useCallback(
    (x: number) => {
      const targetColumn = findDropColumn(x);
      setActiveDropColumn(targetColumn);

      // Animate drop target
      if (targetColumn) {
        dropTargetScale.value = withSpring(1.02, SPRING_CONFIG);
      } else {
        dropTargetScale.value = withSpring(1, SPRING_CONFIG);
      }
    },
    [findDropColumn, dropTargetScale]
  );

  // Pan gesture for drag-and-drop
  const panGesture = useMemo(
    () =>
      Gesture.Pan()
        .onStart((event) => {
          // Drag is initiated via long press on TaskCard
          if (draggedTask) {
            translateX.value = 0;
            translateY.value = 0;
            dragScale.value = withSpring(1.05, SPRING_CONFIG);
            dragOpacity.value = withTiming(1, { duration: 150 });
          }
        })
        .onUpdate((event) => {
          if (draggedTask) {
            translateX.value = event.translationX;
            translateY.value = event.translationY;
            // Update drop column on JS thread
            runOnJS(updateDropColumn)(event.absoluteX);
          }
        })
        .onEnd((event) => {
          if (draggedTask) {
            const targetColumn = findDropColumn(event.absoluteX);
            runOnJS(handleDragEnd)(targetColumn);

            // Reset animations
            translateX.value = withSpring(0, SPRING_CONFIG);
            translateY.value = withSpring(0, SPRING_CONFIG);
            dragScale.value = withSpring(1, SPRING_CONFIG);
            dragOpacity.value = withTiming(0, { duration: 150 });
          }
        })
        .onFinalize(() => {
          // Ensure cleanup on gesture cancel
          if (!draggedTask) {
            dragOpacity.value = withTiming(0, { duration: 150 });
          }
        }),
    [
      draggedTask,
      translateX,
      translateY,
      dragScale,
      dragOpacity,
      updateDropColumn,
      handleDragEnd,
      findDropColumn,
    ]
  );

  // Animated style for the dragged task
  const draggedCardStyle = useAnimatedStyle(() => ({
    position: 'absolute',
    top: 100,
    left: 50,
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: dragScale.value },
    ],
    opacity: dragOpacity.value,
    zIndex: 1000,
    elevation: 10,
  }));

  // Handle scroll position for drop detection
  const handleScroll = useCallback(
    (event: { nativeEvent: { contentOffset: { x: number } } }) => {
      scrollOffset.value = event.nativeEvent.contentOffset.x;
    },
    [scrollOffset]
  );

  // Initialize column layouts
  const initializeLayouts = useCallback(() => {
    const layouts: ColumnLayout[] = KANBAN_COLUMNS.map((col, index) => ({
      status: col.id,
      x: spacing.md + index * (columnWidth + spacing.xs * 2),
      width: columnWidth,
    }));
    setColumnLayouts(layouts);
  }, [columnWidth]);

  // Initialize layouts on mount
  React.useEffect(() => {
    initializeLayouts();
  }, [initializeLayouts]);

  // Render column
  const renderColumn = useCallback(
    (column: ColumnConfig, index: number) => (
      <View
        key={column.id}
        onLayout={(event) =>
          handleColumnLayout(column.id, event.nativeEvent.layout, index)
        }
      >
        <KanbanColumn
          column={column}
          tasks={tasksByStatus[column.id]}
          onTaskPress={onTaskPress}
          onTaskLongPress={onTaskLongPress}
          onDragStart={handleDragStart}
          columnWidth={columnWidth}
          isDragging={isDragging}
          draggedTask={draggedTask}
          isDropTarget={activeDropColumn === column.id}
          dropTargetScale={dropTargetScale}
          testID={`${testID}-column-${column.id}`}
        />
      </View>
    ),
    [
      tasksByStatus,
      onTaskPress,
      onTaskLongPress,
      handleDragStart,
      columnWidth,
      isDragging,
      draggedTask,
      activeDropColumn,
      dropTargetScale,
      handleColumnLayout,
      testID,
    ]
  );

  // Loading state
  if (!tasks) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.accent.primary} />
        <Text style={styles.loadingText}>Loading tasks...</Text>
      </View>
    );
  }

  return (
    <GestureDetector gesture={panGesture}>
      <View style={styles.container} testID={testID}>
        {/* Column headers summary (optional) */}
        <View
          style={styles.headerSummary}
          accessibilityRole="summary"
          accessibilityLabel={`Task summary: ${KANBAN_COLUMNS.map(
            (col) => `${tasksByStatus[col.id].length} ${col.title}`
          ).join(', ')}`}
        >
          {KANBAN_COLUMNS.map((col) => (
            <View
              key={col.id}
              style={styles.summaryItem}
              accessibilityLabel={`${tasksByStatus[col.id].length} tasks in ${col.title}`}
            >
              <View
                style={[styles.summaryDot, { backgroundColor: col.color }]}
                accessibilityElementsHidden
              />
              <Text style={styles.summaryCount}>
                {tasksByStatus[col.id].length}
              </Text>
            </View>
          ))}
        </View>

        {/* Horizontal scrolling board */}
        <ScrollView
          ref={scrollViewRef}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={[
            styles.scrollContent,
            { width: boardWidth },
          ]}
          onScroll={handleScroll}
          scrollEventThrottle={16}
          decelerationRate="fast"
          snapToInterval={columnWidth + spacing.xs * 2}
          snapToAlignment="start"
          scrollEnabled={!isDragging}
          accessibilityLabel="Kanban board with 5 columns: Backlog, In Progress, AI Review, Human Review, Done"
          accessibilityRole="scrollbar"
        >
          {KANBAN_COLUMNS.map(renderColumn)}
        </ScrollView>

        {/* Floating dragged card */}
        {draggedTask && (
          <Animated.View style={[styles.draggedCard, draggedCardStyle]}>
            <TaskCard
              task={draggedTask}
              isDragging={true}
              disabled={true}
            />
          </Animated.View>
        )}

        {/* Drag instruction hint (when dragging) */}
        {isDragging && (
          <View
            style={styles.dragHint}
            accessibilityRole="alert"
            accessibilityLabel="Drag to a column to move task. Release over desired column to drop."
            accessibilityLiveRegion="polite"
          >
            <Text style={styles.dragHintText}>
              Drag to a column to move task
            </Text>
          </View>
        )}
      </View>
    </GestureDetector>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.primary,
  },
  headerSummary: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    gap: spacing.md,
  },
  summaryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  summaryDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  summaryCount: {
    color: colors.text.secondary,
    fontSize: 12,
    fontWeight: '500',
  },
  scrollContent: {
    flexDirection: 'row',
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.lg,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background.primary,
  },
  loadingText: {
    color: colors.text.secondary,
    marginTop: spacing.md,
    fontSize: 14,
  },
  draggedCard: {
    width: 280,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 20,
  },
  dragHint: {
    position: 'absolute',
    bottom: spacing.lg,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  dragHintText: {
    backgroundColor: colors.background.elevated,
    color: colors.text.secondary,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.lg,
    fontSize: 12,
    fontWeight: '500',
    overflow: 'hidden',
  },
});

export default KanbanBoard;
